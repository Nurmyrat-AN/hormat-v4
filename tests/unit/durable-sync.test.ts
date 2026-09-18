import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {VendorCredentials} from '../../src/vendors/credentials.js';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {DurableSyncRepository} from '../../src/vendors/sync/durable-repository.js';
import {DurableSync} from '../../src/vendors/sync/durable.js';
import {VendorSyncRepository,type SyncVendor} from '../../src/vendors/sync/repository.js';
import {VendorSyncManager} from '../../src/vendors/sync/manager.js';
import {VendorEvents} from '../../src/vendors/events.js';
import {syncOptions} from '../../src/vendors/sync/config.js';
import {type ChangesTransport,type Change,SyncFailure} from '../../src/vendors/sync/transport.js';
import {decodeBatch} from '../../src/vendors/sync/mapping.js';
const schema='durable_'+randomUUID().replaceAll('-','');
const db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const repository=new DurableSyncRepository(db),service=new DurableSync(repository),signal=new AbortController().signal;
const options={...syncOptions({}),enabled:true,retryMinMs:5,retryMaxMs:10};
const source=(id:string,type:string,fields:Record<string,unknown>={}):Change=>({id,doc:{_id:id,$dokuman_tipi:type,...fields}});
const product=(id='p',fields:Record<string,unknown>={})=>source(id,'urun',{Adi:'Product',temelSatisFiyati:12.3456,StatusIsAktif:1,idFiyatWalyutasy:'z_walyuta-1',OlcuBirimi:'m',OzelKod1:'00012',OzelKod2:'B',OzelKod3:'C',OzelKod4:'D',OzelKod5:'E',lst_Barkodlar:['00123','ABC','ABC'],...fields});
const refs=()=>[source('settings','ayar_umum',{paraAdi:'TMT'}),source('m','olc_umum',{Adi:'Unit'}),...['x','y','z'].map(id=>source(id,'depo',{Adi:id})),source('currency','z_walyuta',{Adi:'USD'})];
const line=(p='p',quantity:unknown=10)=>({Id_Urun:p,esasOlc_SayisiToplam:quantity,ekOlcu_Sayisi:999,ekOlcu_TemeleOrani:50});
const invoice=(type=201,lines=[line()],extra:Record<string,unknown>={})=>({Tipi:type,id_depo1:'x',id_depo2:'y',lstKalems:lines,sluj_isYanlis:0,...extra});
const zarf=(invoices=[invoice()],id='doc')=>source(id,'zarf',{lst_fatura:invoices,lst_kasa:[{Tipi:101}]});
let counter=0;
async function vendor(){const id=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,date_last_operation) VALUES('Fixture','http://example.invalid/db','user',$1,'2020-01-01Z') RETURNING id",[new VendorCredentials(config.vendors.credentialsKey).encryptSecret('fixture')])).rows[0].id;return (await new VendorSyncRepository(db).get(id))!;}
const emptyTransport:ChangesTransport={async changes(){return {results:[],last_seq:'0'};},async close(){}};
async function apply(v:SyncVendor,changes:Change[],transport=emptyTransport,next='seq:'+ ++counter){const current=(await new VendorSyncRepository(db).get(v.id))!;
 await service.process(v.id,{results:changes,last_seq:next},signal,{vendor:v,transport,since:current.last_sequence??'0'});return next;}
async function fixture(){const v=await vendor();await apply(v,[...refs(),product(),product('q')]);return v;}
async function stock(v:SyncVendor){return (await db.query(`SELECT p.source_id p,w.source_id w,s.stock::text FROM product_stocks s JOIN source_products p ON p.id=s.product_id JOIN warehouses w ON w.id=s.warehouse_id WHERE s.vendor_id=$1 ORDER BY p.source_id,w.source_id`,[v.id])).rows.map(r=>[r.p,r.w,Number(r.stock)]);}
async function state(v:SyncVendor){const result:Record<string,unknown>={};for(const t of ['source_products','product_barcodes','product_stocks','source_stock_movements'])result[t]=(await db.query(`SELECT * FROM ${t} WHERE vendor_id=$1 ORDER BY id`,[v.id])).rows;
 result.vendor=(await db.query('SELECT last_sequence,date_last_sync,date_last_operation FROM vendors WHERE id=$1',[v.id])).rows;return result;}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('registry exact 26 owner effects; seed rerun idempotent; snapshot/source binding constraints',async()=>{
 const rows=(await db.query('SELECT * FROM transaction_types ORDER BY transaction_kind,type_code')).rows;assert.equal(rows.length,26);
 const expected=[
 ['fatura',101,-1,0,1,0,1,0],['fatura',102,-1,0,1,0,1,0],['fatura',103,-1,0,1,0,1,0],
 ...[201,202,203,204].map(n=>['fatura',n,-1,0,-1,0,-1,0]),['fatura',601,0,0,0,0,-1,1],
 ['kasa_islemi',101,1,0,1,0,0,0],['kasa_islemi',102,1,0,-1,0,0,0],['kasa_islemi',103,1,0,1,0,0,0],['kasa_islemi',104,1,0,1,0,0,0],
 ...[201,202,203,204].map(n=>['kasa_islemi',n,-1,0,-1,0,0,0]),['kasa_islemi',400,-1,1,0,0,0,0],['kasa_islemi',500,-1,-1,1,-1,0,0],
 ['kasa_islemi',1001,-1,0,1,0,0,0],['kasa_islemi',1002,-1,0,-1,0,0,0],['kasa_islemi',1101,-1,0,-1,0,0,0],['kasa_islemi',1102,-1,0,1,0,0,0],['kasa_islemi',1201,-1,0,1,0,0,0],['kasa_islemi',1202,-1,0,-1,0,0,0],['kasa_islemi',1301,-1,0,-1,0,0,0],['kasa_islemi',1302,-1,0,1,0,0,0]];
 assert.deepEqual(rows.map(r=>[r.transaction_kind,r.type_code,r.book_1_effect,r.book_2_effect,r.customer_1_effect,r.customer_2_effect,r.warehouse_1_effect,r.warehouse_2_effect]),expected);
 const sql=await readFile('src/database/migrations/028_durable_sync.sql','utf8');await db.query(sql.slice(sql.indexOf('INSERT INTO transaction_types(')));assert.equal((await db.query('SELECT count(*)::int n FROM transaction_types')).rows[0].n,26);
});
test('reference/source mappings preserve opaque IDs, precise price, five properties, strict activity, barcode replacement and FKs',async()=>{
 const v=await vendor();const ids=['123','000123','ABC-123','abc-123'];await apply(v,[...refs(),...ids.map(id=>product(id))]);
 for(const t of ['depo','olc_umum','z_walyuta']){await apply(v,[source('123',t,{Adi:'First'})]);await apply(v,[source('123',t,{Adi:'Renamed'})]);}
 for(const status of [0,100,'1',1]){await apply(v,[product('123',{StatusIsAktif:status,temelSatisFiyati:'0.0091',temelAlisFiyati:999,lst_Barkodlar:['002','004','002']})]);
 const r=(await db.query('SELECT * FROM source_products WHERE vendor_id=$1 AND source_id=$2',[v.id,'123'])).rows[0];assert.equal(r.is_active,status===1);assert.equal(r.price,'0.0091');assert.deepEqual([r.property_1,r.property_2,r.property_3,r.property_4,r.property_5],['00012','B','C','D','E']);}
 assert.deepEqual((await db.query('SELECT source_id FROM source_products WHERE vendor_id=$1 ORDER BY id',[v.id])).rows.map(r=>r.source_id),[...ids].sort());
 assert.deepEqual((await db.query("SELECT barcode FROM product_barcodes b JOIN source_products p ON p.id=b.product_id WHERE p.vendor_id=$1 AND p.source_id='123' ORDER BY barcode",[v.id])).rows.map(r=>r.barcode),['002','004']);
 const currency=(await db.query("SELECT id FROM currencies WHERE vendor_id=$1 AND source_id='z_walyuta-1'",[v.id])).rows[0].id;
 await apply(v,[source('settings','ayar_umum',{paraAdi:'Renamed currency'}),product('000123',{idFiyatWalyutasy:'currency'})]);
 assert.equal((await db.query("SELECT id FROM currencies WHERE vendor_id=$1 AND source_id='z_walyuta-1' AND name='Renamed currency'",[v.id])).rows[0].id,currency);
 assert.equal((await db.query('SELECT count(*)::int n FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM products')).rows[0].n,0);
});
for(const [type,effect] of [[101,1],[102,1],[103,1],[201,-1],[202,-1],[203,-1],[204,-1],[601,-1]])test(`registry fatura ${type}: exact effect, replay and other status fields ignored`,async()=>{
 const v=await fixture();const d=zarf([invoice(type,[line()],{StatusIsAktif:0,tasdik_sene:'x',yln_tarihi:'x',gaytargy:1})]);
 for(let n=0;n<3;n++)await apply(v,[d]);assert.deepEqual(await stock(v),type===601?[['p','x',-10],['p','y',10]]:[['p','x',10*effect]]);
});
test('full OLD/NEW edit scenarios, wrong/restore, quantities, products, warehouse/type/transfer, add/remove/reorder, delete replay',async()=>{
 const v=await fixture();await apply(v,[zarf()]);assert.deepEqual(await stock(v),[['p','x',-10]]);
 await apply(v,[zarf([invoice(201,[line('p',15)])])]);assert.deepEqual(await stock(v),[['p','x',-15]]);
 await apply(v,[zarf([invoice(201,[line('q',15)])])]);assert.deepEqual(await stock(v),[['p','x',0],['q','x',-15]]);
 await apply(v,[zarf([invoice(201,[line('q',15)],{id_depo1:'y'})])]);assert.deepEqual(await stock(v),[['p','x',0],['q','x',0],['q','y',-15]]);
 await apply(v,[zarf([invoice(101,[line('q',15)],{id_depo1:'y'})])]);assert.equal((await stock(v)).at(-1)![2],15);
 await apply(v,[zarf([invoice(601,[line('p',5)])])]);await apply(v,[zarf([invoice(601,[line('p',5)],{id_depo2:'z'})])]);
 assert.deepEqual((await stock(v)).filter(r=>r[0]==='p'),[['p','x',-5],['p','y',0],['p','z',5]]);
 await apply(v,[zarf([invoice(601,[line('p',5)],{id_depo2:'z',sluj_isYanlis:1})])]);assert.ok((await stock(v)).every(r=>r[2]===0));
 for(const flag of [0,false,2,'1']){await apply(v,[zarf([invoice(201,[line('p',3),line('p',7),line('q',5)],{sluj_isYanlis:flag})])]);assert.equal((await stock(v)).find(r=>r[0]==='p'&&r[1]==='x')![2],-10);}
 const before=await stock(v);await apply(v,[zarf([invoice(201,[line('q',5),line('p',7),line('p',3)])])]);assert.deepEqual(await stock(v),before);
 await apply(v,[zarf([invoice(201,[line('p',10)])])]);assert.ok((await stock(v)).filter(r=>r[0]==='q').every(r=>r[2]===0));
 for(let n=0;n<2;n++)await apply(v,[{id:'doc',deleted:true}]);assert.ok((await stock(v)).every(r=>r[2]===0));
 assert.equal((await db.query('SELECT count(*)::int n FROM source_stock_movements WHERE vendor_id=$1',[v.id])).rows[0].n,0);
});
test('decimal SQL accumulation, normalized snapshot uniqueness, negative and zero rows, mixed scope and inactive products',async()=>{
 const v=await fixture();await apply(v,[product('p',{StatusIsAktif:0})]);
 await apply(v,[zarf([invoice(101,[line('p','0.0091'),line('p','0.0009')]),invoice(601,[line('q',2)]),invoice(201,[line('p',5)],{id_depo1:'z'})])]);
 assert.deepEqual(await stock(v),[['p','x',0.01],['p','z',-5],['q','x',-2],['q','y',2]]);
 const value=(await db.query("SELECT stock::text FROM product_stocks s JOIN source_products p ON s.product_id=p.id JOIN warehouses w ON s.warehouse_id=w.id WHERE s.vendor_id=$1 AND p.source_id='p' AND w.source_id='x'",[v.id])).rows[0].stock;assert.equal(value,'0.0100');
 assert.equal((await db.query('SELECT count(*)::int n FROM source_stock_movements WHERE vendor_id=$1',[v.id])).rows[0].n,4);
 await apply(v,[zarf([], 'doc')]);assert.equal((await stock(v)).length,4);assert.ok((await stock(v)).every(r=>r[2]===0));
});
test('unsupported decoded types and kasa have no stock, deletion conservatively preserves products/references/relationships',async()=>{
 const v=await fixture();await apply(v,[zarf()]);const before=await stock(v);
 const p=(await db.query("SELECT id FROM source_products WHERE vendor_id=$1 AND source_id='p'",[v.id])).rows[0].id;await db.query('INSERT INTO products(source_product_id,name) VALUES($1,\'Fixture Product\')',[p]);
 await apply(v,[...['p','m','x','currency'].map(id=>({id,deleted:true})),...['kasa_islemi','z_waka','kagent','defter'].map(type=>source(type,type,{Tipi:101}))]);
 assert.deepEqual(await stock(v),before);assert.equal((await db.query('SELECT is_active FROM source_products WHERE id=$1',[p])).rows[0].is_active,true);
 assert.equal((await db.query('SELECT count(*)::int n FROM products WHERE source_product_id=$1',[p])).rows[0].n,1);
});
for(const [label,changes,code] of [
 ['missing product',[zarf([invoice(201,[line('missing')])])],'MISSING_DEPENDENCY'],
 ['missing warehouse',[zarf([invoice(601,[line()],{id_depo2:'missing'})])],'MISSING_DEPENDENCY'],
 ['unknown type',[zarf([invoice(999999)])],'UNKNOWN_TRANSACTION_TYPE'],
 ['invalid quantity',[zarf([invoice(201,[line('p','bad')])])],'MALFORMED_SOURCE'],
 ['invalid currency',[product('p',{idFiyatWalyutasy:''})],'MALFORMED_SOURCE'],
 ['bad barcode',[product('p',{lst_Barkodlar:[123]})],'MALFORMED_SOURCE'],
 ['decode failure',[{id:'bad',doc:{_id:'bad',load:'never-log-this-cipher'}}],'DECODE_FAILED'],
 ['missing document',[{id:'missing'}],'MALFORMED_SOURCE'],
 ['identity mismatch',[source('p','urun',{_id:'different'})],'MALFORMED_SOURCE'],
] as const)test(`failure safety: ${label}, no partial data/checkpoint/timestamp`,async()=>{
 const v=await fixture(),before=await state(v);await assert.rejects(apply(v,[product('new'),...changes] as Change[]),{code});assert.deepEqual(await state(v),before);
});
test('unused warehouse may be absent; vendor isolation and cross-Vendor missing references',async()=>{
 const a=await fixture(),b=await fixture();await apply(a,[zarf([invoice(201,[line()],{id_depo2:''})])]);assert.deepEqual(await stock(a),[['p','x',-10]]);assert.deepEqual(await stock(b),[]);
 await apply(a,[product('only-a')]);await assert.rejects(apply(b,[zarf([invoice(201,[line('only-a')])])]),{code:'MISSING_DEPENDENCY'});
 await apply(b,[zarf([invoice(101)])]);assert.deepEqual(await stock(b),[['p','x',10]]);
});
test('database injected failures rollback stocks, snapshot, product/barcode state and checkpoint; retry once',async()=>{
 const v=await fixture();await apply(v,[zarf()]);const before=await state(v);
 await db.query(`CREATE FUNCTION fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$`);
 for(const table of ['source_stock_movements','vendors']){
 await db.query(`CREATE TRIGGER fixture_fail_trigger BEFORE ${table==='vendors'?'UPDATE':'INSERT'} ON ${table} FOR EACH ROW EXECUTE FUNCTION fixture_fail()`);
 await assert.rejects(apply(v,[product('new'),zarf([invoice(201,[line('p',15)])])]),{code:'PROCESSING'});
 assert.deepEqual(await state(v),before);await db.query(`DROP TRIGGER fixture_fail_trigger ON ${table}`);
 }
 await apply(v,[zarf([invoice(201,[line('p',15)])])]);assert.deepEqual(await stock(v),[['p','x',-15]]);
});
test('checkpoint exact opaque string, operation date left unchanged, stale writer rejected, concurrent independent documents lose no increments',async()=>{
 const v=await fixture();await apply(v,[zarf() ],emptyTransport,'000ABC:opaque/42');
 const r=(await db.query('SELECT * FROM vendors WHERE id=$1',[v.id])).rows[0];assert.equal(r.last_sequence,'000ABC:opaque/42');assert.ok(r.date_last_sync);assert.equal(r.date_last_operation.toISOString(),'2020-01-01T00:00:00.000Z');
 await assert.rejects(repository.commit(v,[],signal,{since:'old',next:'bad'}),{code:'STALE_CHECKPOINT'});
 // Independent transactions serialize the OLD snapshot and atomic stock arithmetic in PostgreSQL.
 await Promise.all(['other1','other2','other3'].map(id=>repository.commit(v,decodeBatch({results:[zarf([invoice(101,[line('p','0.1')])],id)],last_seq:'unused'}),signal)));
 assert.equal((await stock(v))[0][2],-9.7);
});
test('bootstrap later references, bulk products, changes during scan, catch-up and restart checkpoint',async()=>{
 const v=await vendor();let calls=0,fetches=0;
 const transport:ChangesTransport={async changes(since){calls++;if(since==='0')return {results:[zarf()],last_seq:'first'};if(since==='first')return {results:[...refs(),product()],last_seq:'S'};return {results:[],last_seq:'S'};},async fetchDocuments(ids){fetches++;return ids.includes('p')?[product()]:[];},async close(){}};
 assert.equal(await service.prepare(v,transport,signal),'0');assert.equal((await new VendorSyncRepository(db).get(v.id))!.last_sequence,null);
 assert.equal((await stock(v)).length,0);assert.equal(calls,3);
 await apply(v,[zarf()],transport,'first');assert.equal(fetches,1);assert.deepEqual(await stock(v),[['p','x',-10]]);
 await apply(v,[...refs(),product(),zarf([invoice(201,[line('p',15)])])],transport,'S:changed-during-scan');
 assert.equal(await new DurableSync(repository).prepare(v,transport,signal),'S:changed-during-scan');assert.equal(calls,3);assert.deepEqual(await stock(v),[['p','x',-15]]);
});
test('cross-batch product/measure/currency dependencies use bounded bulk fetch and never placeholders',async()=>{
 const v=await fixture();let requests:string[][]=[];
 const docs=[product('later',{idFiyatWalyutasy:'later-currency',OlcuBirimi:'later-measure'}),source('later-currency','z_walyuta',{Adi:'Later'}),source('later-measure','olc_umum',{Adi:'Later'})];
 const transport={...emptyTransport,async fetchDocuments(ids:string[]){requests.push(ids);return docs.filter(d=>ids.includes(d.id));}};
 await apply(v,[zarf([invoice(101,[line('later')])])],transport);assert.equal(requests.length,2);assert.equal(requests[1].length,2);assert.deepEqual(await stock(v),[['later','x',10]]);
});
test('URL binding survives restart; pauses never clear any data; unbound legacy checkpoints rejected',async()=>{
 const v=await fixture();await apply(v,[zarf()]);const before=await state(v);
 await db.query('UPDATE vendors SET url=$2 WHERE id=$1',[v.id,'http://example.invalid/other']);const changed=(await new VendorSyncRepository(db).get(v.id))!;
 await assert.rejects(new DurableSync(repository).prepare(changed,emptyTransport,signal),{code:'SOURCE_CHANGED'});assert.deepEqual(await state(v),before);
 await db.query('UPDATE vendors SET url=$2,is_active=false WHERE id=$1',[v.id,v.url]);await assert.rejects(service.prepare(v,emptyTransport,signal),{code:'VENDOR_PAUSED'});assert.deepEqual(await state(v),before);
 await db.query('UPDATE vendors SET is_active=true WHERE id=$1',[v.id]);assert.equal(await service.prepare(v,emptyTransport,signal),(before.vendor as any)[0].last_sequence);
 const legacy=await vendor();await db.query("UPDATE vendors SET last_sequence='unbound' WHERE id=$1",[legacy.id]);await assert.rejects(service.prepare(legacy,emptyTransport,signal),{code:'SOURCE_CHANGED'});
});
async function until(check:()=>Promise<boolean>){for(let n=0;n<500;n++){if(await check())return;await delay(5);}assert.fail('did not converge');}
test('real manager durable restart, outage, credential reconnect, pause/reactivate, URL fail closed and safe logs',async()=>{
 const v=await fixture();const events=new VendorEvents(),logs:any[]=[],requests:string[]=[];let fail=false;
 const manager=new VendorSyncManager({async activeIds(){return [v.id];},get:id=>new VendorSyncRepository(db).get(id)},{decryptSecret:()=>''},events,options,()=>({
 async changes(since,signal){requests.push(String(since));if(fail){fail=false;throw new SyncFailure('CONNECTION');}await delay(100000,undefined,{signal});throw Error();},async close(){}
 }),service.process,(e,f)=>logs.push({e,...f}),service.prepare);
 try{
 await manager.start();await until(async()=>requests.length===1);const checkpoint=requests[0];
 await db.query("UPDATE vendors SET password_encrypted=$2 WHERE id=$1",[v.id,new VendorCredentials(config.vendors.credentialsKey).encryptSecret('replacement')]);fail=true;await manager.refresh(v.id);await until(async()=>requests.length>=3);assert.ok(requests.every(s=>s===checkpoint));
 await db.query('UPDATE vendors SET is_active=false WHERE id=$1',[v.id]);await manager.refresh(v.id);assert.equal(manager.getStatus().length,0);
 await db.query('UPDATE vendors SET is_active=true WHERE id=$1',[v.id]);await manager.refresh(v.id);await until(async()=>requests.length>=4);
 await manager.stop();await manager.start();await until(async()=>requests.length>=5);assert.ok(requests.every(s=>s===checkpoint));
 await db.query("UPDATE vendors SET url='http://example.invalid/other' WHERE id=$1",[v.id]);await manager.refresh(v.id);await until(async()=>manager.getStatus()[0]?.lastError==='SOURCE_CHANGED');
 assert.equal(requests.length,5);assert.ok(!JSON.stringify(logs).includes('password_encrypted'));
 }finally{await manager.stop();}
});

test('snapshot same-Vendor foreign keys, unique identity and reference replay under two Vendors',async()=>{
 const a=await fixture(),b=await fixture();await apply(a,[zarf()]);
 const row=(await db.query('SELECT * FROM source_stock_movements WHERE vendor_id=$1',[a.id])).rows[0];
 await assert.rejects(db.query('INSERT INTO source_stock_movements(vendor_id,source_document_id,product_id,warehouse_id,stock_delta) VALUES($1,$2,$3,$4,$5)',[a.id,row.source_document_id,row.product_id,row.warehouse_id,row.stock_delta]),{code:'23505'});
 await assert.rejects(db.query('INSERT INTO source_stock_movements(vendor_id,source_document_id,product_id,warehouse_id,stock_delta) VALUES($1,$2,$3,$4,$5)',[b.id,row.source_document_id,row.product_id,row.warehouse_id,row.stock_delta]),{code:'23503'});
 for(const v of [a,b])for(let n=0;n<2;n++)await apply(v,refs());
 for(const table of ['warehouses','measures','currencies']){const rows=(await db.query(`SELECT vendor_id,source_id,count(*)::int n FROM ${table} WHERE vendor_id=ANY($1::bigint[]) GROUP BY vendor_id,source_id`,[[a.id,b.id]])).rows;assert.ok(rows.every(r=>r.n===1));assert.ok(rows.some(r=>r.vendor_id===a.id)&&rows.some(r=>r.vendor_id===b.id));}
});
test('empty polls with unchanged sequence do not falsify last progress time; aborted batch leaves state unchanged',async()=>{
 const v=await fixture(),before=await state(v);const seq=(before.vendor as any)[0].last_sequence;
 await apply(v,[],emptyTransport,seq);assert.deepEqual(await state(v),before);
 const abort=new AbortController();abort.abort();await assert.rejects(repository.commit(v,decodeBatch({results:[zarf()],last_seq:'bad'}),abort.signal,{since:seq,next:'bad'}));assert.deepEqual(await state(v),before);
});
test('lost COMMIT acknowledgement reconnect reloads durable checkpoint, with no duplicated stock',async()=>{
 const v=await fixture(),requests:string[]=[];let lost=false;const before=(await new VendorSyncRepository(db).get(v.id))!.last_sequence!;
 const manager=new VendorSyncManager({activeIds:async()=>[v.id],get:id=>new VendorSyncRepository(db).get(id)},{decryptSecret:()=>''},new VendorEvents(),options,()=>({
 async changes(since,signal){requests.push(String(since));if(since===before)return {results:[zarf()],last_seq:'committed-before-disconnect'};await delay(100000,undefined,{signal});throw Error();},async close(){}
 }),async(id,b,s,c)=>{const result=await service.process(id,b,s,c);if(!lost){lost=true;throw Error('simulated lost acknowledgement');}return result;},()=>{},service.prepare);
 try{await manager.start();await until(async()=>requests.length>=2);assert.deepEqual(requests.slice(0,2),[before,'committed-before-disconnect']);assert.deepEqual(await stock(v),[['p','x',-10]]);}finally{await manager.stop();}
});
test('bootstrap cannot overwrite references once another durable worker has advanced checkpoint',async()=>{
 const v=await fixture(),before=await state(v);await assert.rejects(repository.commit(v,decodeBatch({results:[source('settings','ayar_umum',{paraAdi:'stale'})],last_seq:'unused'}),signal,undefined,true),{code:'STALE_CHECKPOINT'});assert.deepEqual(await state(v),before);
});

test('malformed deletion flags and invalid batch sequence cannot erase snapshots or checkpoint',async()=>{
 const v=await fixture();await apply(v,[zarf()]);const before=await state(v);
 for(const change of [{id:'doc',deleted:'false'},{id:'doc',doc:{_id:'doc',_deleted:'false'}}])await assert.rejects(apply(v,[change as any]));
 for(const last_seq of ['',NaN,undefined])assert.throws(()=>decodeBatch({results:[],last_seq:last_seq as any}));
 assert.deepEqual(await state(v),before);
});

test('source edit dates: all types participate, unsupported maximum wins, replay never regresses, fatura business dates ignored',async()=>{
 const v=await fixture();await db.query('UPDATE vendors SET date_last_operation=NULL WHERE id=$1',[v.id]);
 const date=async()=>(await db.query(`SELECT to_char(date_last_operation AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') value FROM vendors WHERE id=$1`,[v.id])).rows[0].value;
 const dated=(change:Change,value:string)=>({...change,doc:{...change.doc,uytgeme_tarih:value}});
 await apply(v,[dated(product(),'2026-09-16T15:00:00+05:00'),dated(source('x','depo',{Adi:'Warehouse'}),'2026-09-16T15:03:00+05:00'),dated(zarf([invoice(201,[line()],{Tarihi:'2099-01-01T00:00:00Z',uytgeme_tarih:'2099-01-01T00:00:00Z'})]),'2026-09-16T15:02:00+05:00'),dated(source('activity','z_waka'),'2026-09-16T15:05:00.367362+05:00')]);
 assert.equal(await date(),'2026-09-16T10:05:00.367362');
 await apply(v,[dated(source('old','z_waka'),'2026-09-16T09:00:00Z')]);assert.equal(await date(),'2026-09-16T10:05:00.367362');
 await apply(v,[dated(product(),'2026-09-16T10:07:00Z')]);assert.equal(await date(),'2026-09-16T10:07:00.000000');
 // Compare instants rather than string order: 11:00+05 is earlier than 10:07Z.
 await apply(v,[dated(source('old-offset','z_waka'),'2026-09-16T11:00:00+05:00')]);assert.equal(await date(),'2026-09-16T10:07:00.000000');
 await apply(v,[dated(source('legacy-fraction','z_waka'),'2026-09-16T10:08:00.8156177Z')]);assert.equal(await date(),'2026-09-16T10:08:00.815618');
});
test('operation date excludes invalid, absent, offset-less, tombstone and failed-decode timestamps; rollback is atomic',async()=>{
 const v=await fixture(),before=await state(v);
 await apply(v,[source('invalid','z_waka',{uytgeme_tarih:'2026-02-30T12:00:00Z'}),source('no-offset','z_waka',{uytgeme_tarih:'2099-01-01T00:00:00'}),{id:'gone',deleted:true,doc:{_id:'gone',_deleted:true,uytgeme_tarih:'2099-01-01T00:00:00Z'}}]);
 assert.deepEqual((await state(v)).vendor[0].date_last_operation,(before.vendor as any)[0].date_last_operation);
 const stable=await state(v);await assert.rejects(apply(v,[source('later','z_waka',{uytgeme_tarih:'2099-01-01T00:00:00Z'}),{id:'bad',doc:{_id:'bad',load:'invalid',uytgeme_tarih:'2099-01-01T00:00:00Z'}}]),{code:'DECODE_FAILED'});assert.deepEqual(await state(v),stable);
 await db.query(`CREATE FUNCTION operation_date_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$`);
 await db.query('CREATE TRIGGER operation_date_failure AFTER UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION operation_date_failure()');
 try{await assert.rejects(apply(v,[source('later','z_waka',{uytgeme_tarih:'2099-01-01T00:00:00Z'}),zarf()]),{code:'PROCESSING'});assert.deepEqual(await state(v),stable);}
 finally{await db.query('DROP TRIGGER operation_date_failure ON vendors');}
});
test('dependency reads beyond stream checkpoint do not contribute their future edit timestamp',async()=>{
 const v=await fixture(),before=await state(v);
 const transport={...emptyTransport,async fetchDocuments(){return [product('future',{uytgeme_tarih:'2099-01-01T00:00:00Z'})];}};
 await apply(v,[zarf([invoice(201,[line('future')])])],transport);
 assert.deepEqual((await state(v)).vendor[0].date_last_operation,(before.vendor as any)[0].date_last_operation);
});


test('missing main currency uses Vendor name, then real settings preserve currency ID and product relationships',async()=>{
 const v=await vendor();await apply(v,[source('earlier','unsupported')],emptyTransport,'saved-position');
 const requests:string[][]=[];
 const transport={...emptyTransport,async fetchDocuments(ids:string[]){requests.push(ids);return ids.includes('m')?[source('m','olc_umum',{Adi:'Unit'})]:[];}};
 await apply(v,[product()],transport,'next-position');
 assert.ok(requests.some(ids=>ids.includes('z_walyuta-1')&&ids.includes('ayar_umum-1')));
 const currency=()=>db.query("SELECT id,name FROM currencies WHERE vendor_id=$1 AND source_id='z_walyuta-1'",[v.id]);
 const initial=(await currency()).rows[0];assert.equal(initial.name,'Fixture.walyuta1');
 const relation=(await db.query('SELECT currency_id FROM source_products WHERE vendor_id=$1',[v.id])).rows[0].currency_id;assert.equal(relation,initial.id);
 await apply(v,[source('ayar_umum-1','ayar_umum',{paraAdi:'TMT'})]);
 assert.deepEqual((await currency()).rows[0],{id:initial.id,name:'TMT'});
 assert.equal((await db.query('SELECT currency_id FROM source_products WHERE vendor_id=$1',[v.id])).rows[0].currency_id,relation);
});
test('main currency exception does not cover other missing references or failed source requests',async()=>{
 for(const scenario of ['otherCurrency','missingMeasure','network']){
  const v=await vendor(),before=await state(v);
  const transport={...emptyTransport,async fetchDocuments(){if(scenario==='network')throw new SyncFailure('CONNECTION');return [];}};
  await assert.rejects(apply(v,[product('p',scenario==='otherCurrency'?{idFiyatWalyutasy:'other'}:{})],transport),{code:scenario==='network'?'CONNECTION':'MISSING_DEPENDENCY'});
  assert.deepEqual(await state(v),before);
  assert.equal((await db.query('SELECT count(*)::int n FROM currencies WHERE vendor_id=$1',[v.id])).rows[0].n,0);
 }
});
