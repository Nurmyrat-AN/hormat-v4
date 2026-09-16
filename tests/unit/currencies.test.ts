import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {CurrenciesRepository,type CurrencyActor} from '../../src/currencies/repository.js';
import {CurrenciesService} from '../../src/currencies/service.js';
import {VendorCredentials} from '../../src/vendors/credentials.js';
import {convertPrice} from '../../src/currencies/conversion.js';
const schema='currency_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),service=new CurrenciesService(new CurrenciesRepository(db));
let root:CurrencyActor,normal:CurrencyActor,va:string,vb:string,ca:string,cb:string;
const create=async(extra:Record<string,unknown>={})=>(await service.mutate(root,'create',undefined,{name:'Base '+randomUUID(),code:'USD',symbol:'$',...extra})).row;
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Currency test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
async function grants(values:Record<string,unknown>){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);for(const [key,value]of Object.entries(values))await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);}
const stored=async(id:string)=>(await db.query('SELECT * FROM frontend_currencies WHERE id=$1',[id])).rows[0];
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);const vendors=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES('Supplier A','https://example.invalid/db','fixture',$1,false),('Supplier B','https://example.invalid/db','fixture',$1,false) RETURNING id",[new VendorCredentials(config.vendors.credentialsKey).encryptSecret('fixture')])).rows;[va,vb]=vendors.map(r=>r.id);const currencies=(await db.query("INSERT INTO currencies(vendor_id,source_id,name) VALUES($1,'usd','USD'),($2,'eur','EUR') RETURNING id",[va,vb])).rows;[ca,cb]=currencies.map(r=>r.id);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('Currency schema, nullable rate, Hidden/ordering defaults, real Create and server-owned fields',async()=>{
 const row=await create({name:'  Dollar  '}),record=await stored(row.id);assert.equal(row.name,'Dollar');assert.equal(row.visible,false);assert.equal(row.rate,null);assert.equal(row.sort,'0');assert.deepEqual(row.translations,{});assert.equal(record.created_by,root.id);
 const columns=(await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name IN('frontend_currencies','vendor_currency_rates')",[schema])).rows;
 for(const table of ['frontend_currencies','vendor_currency_rates'])assert.equal(columns.find(r=>r.table_name===table&&r.column_name==='rate').data_type,'numeric');
 for(const extra of [{name:''},{symbol:''},{sort_order:1.5},{id:'2'},{created_by:normal.id},{is_visible:true}])await assert.rejects(create(extra));
 await assert.rejects(db.query("UPDATE frontend_currencies SET rate=0 WHERE id=$1",[row.id]),{code:'23514'});
 for(const value of ['NaN','Infinity','-Infinity','-1'])await assert.rejects(db.query('UPDATE frontend_currencies SET rate=$2 WHERE id=$1',[row.id,value]),{code:'23514'});
});
test('Frontend Basic/visibility/translation persistence, active-language validation and fallback isolation',async()=>{
 const row=await create({name:'Fallback',rate:'0.1234567890123456789'});await service.mutate(root,'translations',row.id,{translations:{ru:' Имя ',en:'English'}});
 await service.mutate(root,'basic',row.id,{name:'Updated',is_visible:true,sort_order:-3});let result=(await service.details(root,row.id)).row;assert.equal(result.translations.ru,'Имя');assert.equal(result.rate,'0.1234567890123456789');assert.equal(result.sort,'-3');assert.equal(result.visible,true);
 await service.mutate(root,'translations',row.id,{translations:{ru:'   '}});result=(await service.details(root,row.id)).row;assert.equal(result.translations.ru,undefined);assert.equal(result.name,'Updated');assert.equal(result.translations.en,'English');assert.equal(result.visible,true);
 await assert.rejects(service.mutate(root,'translations',row.id,{translations:{unknown:'bad'}}));await db.query("UPDATE languages SET is_active=false WHERE code='ru'");await assert.rejects(service.mutate(root,'translations',row.id,{translations:{ru:'bad'}}));await db.query("UPDATE languages SET is_active=true WHERE code='ru'");
 await assert.rejects(db.query("INSERT INTO frontend_currency_translations(frontend_currency_id,language_code,name) VALUES($1,'en','Duplicate')",[row.id]),{code:'23505'});
 await db.query(`CREATE FUNCTION reject_currency_translation() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.name='FAIL' THEN RAISE EXCEPTION 'forced'; END IF; RETURN NEW; END$$; CREATE TRIGGER reject_translation BEFORE INSERT OR UPDATE ON frontend_currency_translations FOR EACH ROW EXECUTE FUNCTION reject_currency_translation()`);
 await assert.rejects(service.mutate(root,'translations',row.id,{translations:{en:'Must rollback',tm:'FAIL'}}),{code:'CURRENCY_SAVE_FAILED'});assert.equal((await service.details(root,row.id)).row.translations.en,'English');
});
test('Frontend search/filter/order and exact nullable decimal updates',async()=>{
 const a=await create({name:'Needle %',code:'CODEA',symbol:'§',sort_order:10}),b=await create({name:'Needle B',sort_order:2});await service.mutate(root,'basic',b.id,{is_visible:true});
 assert.deepEqual((await service.list(root,{query:'Needle'})).rows.map(r=>r.id),[b.id,a.id]);assert.deepEqual((await service.list(root,{query:'Needle',visibility:'visible'})).rows.map(r=>r.id),[b.id]);
 for(const query of ['%','CODEA','§'])assert.equal((await service.list(root,{query})).rows[0].id,a.id);assert.equal((await service.list(root,{query:"' OR true --"})).rows.length,0);
 for(const value of ['1','20.5','0.00000000000000000001',null]){await service.mutate(root,'basic',a.id,{rate:value});assert.equal((await stored(a.id)).rate,value);}
 for(const value of ['0','-1','NaN','Infinity','1e2','',true,1,{}])await assert.rejects(service.mutate(root,'basic',a.id,{rate:value}),{code:'CURRENCY_INVALID_RATE'});
 await assert.rejects(service.mutate(root,'basic',a.id,{is_visible:'true'}));await assert.rejects(service.mutate(root,'basic',a.id,{translations:{en:'bad'}}));
});
test('Vendor all-source LEFT JOIN/search, configure/clear and same-Vendor FK integrity',async()=>{
 const before=(await db.query('SELECT * FROM currencies ORDER BY id')).rows;
 let result=await service.vendorList(root,{});assert.equal(result.currencies.length,2);assert.ok(result.currencies.every(r=>r.rate===null));assert.equal((await db.query('SELECT * FROM vendor_currency_rates')).rowCount,0);
 assert.equal((await service.vendorList(root,{query:'Supplier A.USD'})).currencies[0].id,ca);assert.equal((await service.vendorList(root,{query:'EUR'})).currencies[0].id,cb);assert.equal((await service.vendorList(root,{query:'Supplier'})).currencies.length,2);
 await service.saveVendorRate(root,va,ca,{rate:'20.5'});assert.equal((await service.vendorDetails(root,va,ca)).row.rate,'20.5');await service.saveVendorRate(root,va,ca,{rate:'1'});assert.equal((await service.vendorDetails(root,va,ca)).row.rate,'1');
 await assert.rejects(service.saveVendorRate(root,vb,ca,{rate:'2'}),{code:'CURRENCY_NOT_FOUND'});await assert.rejects(db.query('INSERT INTO vendor_currency_rates(vendor_id,currency_id,rate) VALUES($1,$2,2)',[va,cb]),{code:'23503'});
 await service.saveVendorRate(root,va,ca,{rate:null});assert.equal((await service.vendorDetails(root,va,ca)).row.rate,null);assert.equal((await db.query('SELECT * FROM vendor_currency_rates WHERE currency_id=$1',[ca])).rowCount,0);
 for(const input of [{rate:'0'},{rate:'-1'},{rate:'NaN'},{rate:1},{rate:'1',vendor_id:vb},{rate:'1',name:'Changed'},{}])await assert.rejects(service.saveVendorRate(root,va,ca,input));
 assert.deepEqual((await db.query('SELECT * FROM currencies ORDER BY id')).rows,before);
});
test('Central conversion uses NUMERIC, missing=1 without DB writes, explicit 1 and high precision',async()=>{
 const before=(await db.query('SELECT count(*) FROM vendor_currency_rates')).rows[0].count;
 assert.equal(await convertPrice('12','20','15',db),'16');assert.equal(await convertPrice('12',null,'15',db),'0.8');assert.equal(await convertPrice('12','20',undefined,db),'240');assert.equal(await convertPrice('12',undefined,null,db),'12');assert.equal(await convertPrice('12','1','1',db),'12');assert.equal(await convertPrice('0.1','0.2','1',db),'0.02');assert.equal(await convertPrice('9007199254740993','3','1',db),'27021597764222979');
 assert.equal(await convertPrice('1',null,'3',db),'0.33333333333333333333');for(const invalid of ['0','-1','NaN','Infinity'])await assert.rejects(convertPrice('12',invalid,'1',db));await assert.rejects(convertPrice('NaN',null,null,db));assert.equal((await db.query('SELECT count(*) FROM vendor_currency_rates')).rows[0].count,before);
});
test('Independent six exact-boolean permissions, Super User bypass and current session checks',async()=>{
 const row=await create();const actions:Record<string,()=>Promise<unknown>>={
 'currencies.frontend.view':()=>service.details(normal,row.id),
 'currencies.frontend.create':()=>service.mutate(normal,'create',undefined,{name:'Allowed',code:'A',symbol:'A'}),
 'currencies.frontend.update':()=>service.mutate(normal,'basic',row.id,{name:'Allowed'}),
 'currencies.frontend.visibility':()=>service.mutate(normal,'basic',row.id,{is_visible:true}),
 'currencies.vendor_rates.view':()=>service.vendorDetails(normal,va,ca),
 'currencies.vendor_rates.update':()=>service.saveVendorRate(normal,va,ca,{rate:'2'}),
 };
 for(const [permission,action]of Object.entries(actions)){
  for(const value of [false,'true',1,null]){await grants({[permission]:value});await assert.rejects(action(),{code:'CURRENCY_FORBIDDEN'});}
  await grants({[permission]:true});await action();for(const [other,denied]of Object.entries(actions))if(other!==permission)await assert.rejects(denied(),{code:'CURRENCY_FORBIDDEN'});
 }
 await grants({'currencies.frontend.update':true});await service.mutate(normal,'translations',row.id,{translations:{tm:'At'}});await assert.rejects(service.mutate(normal,'basic',row.id,{name:'No',is_visible:false}),{code:'CURRENCY_FORBIDDEN'});
 assert.equal((await db.query('SELECT count(*) FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows[0].count,'1');
 await db.query('DELETE FROM cpanel_sessions WHERE user_id=$1',[normal.id]);await assert.rejects(service.mutate(normal,'basic',row.id,{name:'No'}),{code:'CURRENCY_FORBIDDEN'});
});
