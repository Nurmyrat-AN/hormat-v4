import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {VendorCredentials} from '../../src/vendors/credentials.js';
import {VendorsRepository,type VendorActor} from '../../src/vendors/repository.js';
import {VendorSyncResetService} from '../../src/vendors/sync/reset.js';
import {VendorSyncManager} from '../../src/vendors/sync/manager.js';
import {VendorSyncRepository,type SyncVendor} from '../../src/vendors/sync/repository.js';
import {DurableSyncRepository} from '../../src/vendors/sync/durable-repository.js';
import {DurableSync} from '../../src/vendors/sync/durable.js';
import {VendorEvents} from '../../src/vendors/events.js';
import {syncOptions} from '../../src/vendors/sync/config.js';
import {type ChangesTransport,type Change} from '../../src/vendors/sync/transport.js';
const schema='reset_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const repo=new VendorsRepository(db),internal=new VendorSyncRepository(db),durable=new DurableSync(new DurableSyncRepository(db));
const credentials=new VendorCredentials(config.vendors.credentialsKey),signal=new AbortController().signal;
const options={...syncOptions({}),enabled:true,retryMinMs:10,retryMaxMs:20};
const source=(id:string,type:string,fields:Record<string,unknown>={}):Change=>({id,doc:{_id:id,$dokuman_tipi:type,uytgeme_tarih:'2026-01-01T00:00:00Z',...fields}});
const references=()=>[source('settings','ayar_umum',{paraAdi:'TMT'}),source('currency','z_walyuta',{Adi:'USD'}),source('m','olc_umum',{Adi:'Unit'}),source('w','depo',{Adi:'Warehouse'})];
const product=()=>source('p','urun',{Adi:'Product',temelSatisFiyati:12,StatusIsAktif:1,OlcuBirimi:'m',idFiyatWalyutasy:'z_walyuta-1',lst_Barkodlar:['00123']});
const movement=(id:string,kind:number,quantity:number)=>source(id,'zarf',{lst_fatura:[{Tipi:kind,id_depo1:'w',sluj_isYanlis:0,lstKalems:[{Id_Urun:'p',esasOlc_SayisiToplam:quantity}]}]});
const inert:ChangesTransport={async changes(_s,signal){await delay(100000,undefined,{signal});throw Error();},async close(){}};
let root:VendorActor,normal:VendorActor,sequence=0;
async function actor(superuser:boolean){const u=await bootstrapSuperuser({name:'Reset fixture',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[u.id]);const session=await new SessionRepository(db).create(u.id);return {id:u.id,sessionHash:session.session.token_hash};}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
async function vendor(){const id=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted) VALUES('Reset fixture','http://example.invalid/db','test',$1) RETURNING id",[credentials.encryptSecret('test')])).rows[0].id;return (await internal.get(id))!;}
async function apply(v:SyncVendor,docs:Change[]){const current=(await internal.get(v.id))!;await durable.process(v.id,{results:docs,last_seq:'checkpoint:'+ ++sequence},signal,{vendor:v,transport:inert,since:current.last_sequence??'0'});}
async function fixture(){const v=await vendor();await apply(v,[...references(),product(),movement('purchase',101,10),movement('sale',201,3)]);await db.query('INSERT INTO products(source_product_id,name) SELECT id,name FROM source_products WHERE vendor_id=$1',[v.id]);return v;}
function manager(ids:string[],enabled=false,transport=(_v:SyncVendor)=>inert){return new VendorSyncManager({activeIds:async()=>ids,get:id=>internal.get(id)},credentials,new VendorEvents(),{...options,enabled},transport,durable.process,()=>{},durable.prepare);}
async function snapshot(v:SyncVendor){const data:Record<string,unknown>={};for(const t of ['vendors','warehouses','currencies','measures','source_products','product_barcodes','product_stocks','source_stock_movements','vendor_sync_sources'])data[t]=(await db.query(`SELECT * FROM ${t} WHERE ${t==='vendors'?'id':'vendor_id'}=$1 ORDER BY ${t==='vendor_sync_sources'?'vendor_id':'id'}`,[v.id])).rows;data.products=(await db.query('SELECT * FROM products WHERE source_product_id IN(SELECT id FROM source_products WHERE vendor_id=$1) ORDER BY id',[v.id])).rows;data.transaction_types=(await db.query('SELECT * FROM transaction_types ORDER BY id')).rows;return data;}
async function resetState(v:SyncVendor){const row=(await repo.authorized(root,'vendors.reset_sync',c=>repo.get(c,v.id)));assert.equal(row.last_sequence,'0');assert.equal(row.date_last_sync,null);assert.equal(row.date_last_operation,null);for(const t of ['product_stocks','source_stock_movements'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${t} WHERE vendor_id=$1`,[v.id])).rows[0].n,0);}
async function until(check:()=>Promise<boolean>|boolean){for(let n=0;n<400;n++){if(await check())return;await delay(5);}assert.fail('Timed out');}

test('reset clears only selected derived state; config, IDs, references, barcode, Products FK and other Vendor preserved',async()=>{
 const a=await fixture(),b=await fixture();await db.query('UPDATE vendors SET is_active=false WHERE id=$1',[a.id]);const before=await snapshot(a),other=await snapshot(b);
 const m=manager([a.id]);try{const result=await new VendorSyncResetService(m,repo).reset(root,a.id,{});assert.equal(result.code,'VENDOR_RESET_COMPLETED');await resetState(a);const after=await snapshot(a);
 for(const table of ['warehouses','currencies','measures','source_products','product_barcodes','products','transaction_types','vendor_sync_sources'])assert.deepEqual(after[table],before[table]);
 const old=(before.vendors as any[])[0],current=(after.vendors as any[])[0];for(const key of ['id','name','url','username','password_encrypted','is_active','created_at'])assert.deepEqual(current[key],old[key]);assert.deepEqual(await snapshot(b),other);assert.deepEqual(m.getStatus(),[]);
 }finally{await m.stop();}
});
test('replay rebuilds purchase10-sale3=7; OLD -10 snapshot cannot cancel replay; source IDs reused',async()=>{
 const v=await fixture(),m=manager([v.id]),reset=new VendorSyncResetService(m,repo);const before=await snapshot(v);
 try{await reset.reset(root,v.id,{});await apply(v,[...references(),product(),movement('purchase',101,10),movement('sale',201,3)]);assert.equal((await db.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock,'7');
 const after=await snapshot(v);for(const t of ['warehouses','currencies','measures','source_products'])assert.deepEqual((after[t] as any[]).map(r=>r.id),(before[t] as any[]).map(r=>r.id));assert.deepEqual(after.products,before.products);
 await reset.reset(root,v.id,{});await apply(v,[movement('old-sale',201,10)]);assert.equal((await db.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock,'-10');await reset.reset(root,v.id,{});await apply(v,[movement('old-sale',201,10)]);assert.equal((await db.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock,'-10');assert.equal((await db.query('SELECT count(*)::int n FROM source_stock_movements WHERE vendor_id=$1',[v.id])).rows[0].n,1);
 }finally{await m.stop();}
});
test('reset permission exact true only, independent of update/status; Super User without individual row; unauthorized cannot pause',async()=>{
 const v=await fixture(),m=manager([v.id]),reset=new VendorSyncResetService(m,repo);let pauses=0;const original=m.withPausedVendor.bind(m);m.withPausedVendor=(id,fn)=>{pauses++;return original(id,fn);};
 try{for(const val of [undefined,false,'true',1,null,true]){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);for(const key of ['vendors.view','vendors.update','vendors.status'])await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,'true']);if(val!==undefined)await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'vendors.reset_sync',$2)",[normal.id,JSON.stringify(val)]);const before=await snapshot(v),count=pauses;if(val===true)await reset.reset(normal,v.id,{});else{await assert.rejects(reset.reset(normal,v.id,{}),{code:'VENDOR_FORBIDDEN'});assert.deepEqual(await snapshot(v),before);assert.equal(pauses,count);}}
 await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'vendors.reset_sync','true')",[normal.id]);await reset.reset(normal,v.id,{});await reset.reset(root,v.id,{});assert.deepEqual((await db.query('SELECT key FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows,[{key:'superuser'}]);
 await assert.rejects(reset.reset({...root,sessionHash:'expired'},v.id,{}),{code:'VENDOR_FORBIDDEN'});
 }finally{await m.stop();}
});
test('strict payload/target validation, missing Vendor, source identity mismatch and unbound old checkpoint fail without mutation',async()=>{
 const v=await fixture(),m=manager([v.id]),reset=new VendorSyncResetService(m,repo);try{const before=await snapshot(v);
 for(const input of [null,[],true,{id:v.id},{vendor_id:v.id},{last_sequence:'x'},{confirm:true}])await assert.rejects(reset.reset(root,v.id,input),{code:'VENDOR_INVALID_REQUEST'});
 for(const id of ['0','-1','1 OR TRUE','9223372036854775808','999999999'])await assert.rejects(reset.reset(root,id,{}),{code:'VENDOR_NOT_FOUND'});assert.deepEqual(await snapshot(v),before);
 await db.query("UPDATE vendors SET url='http://other.invalid/db' WHERE id=$1",[v.id]);const changed=await snapshot(v);await assert.rejects(reset.reset(root,v.id,{}),{code:'VENDOR_RESET_SOURCE_CHANGED'});assert.deepEqual(await snapshot(v),changed);
 const fresh=await vendor();await db.query("UPDATE vendors SET last_sequence='unbound' WHERE id=$1",[fresh.id]);await assert.rejects(reset.reset(root,fresh.id,{}),{code:'VENDOR_RESET_SOURCE_CHANGED'});
 }finally{await m.stop();}
});
for(const failure of ['source_stock_movements','vendors'])test('SQL failure at '+failure+' rolls back deletes, checkpoint and dates and restores worker',async()=>{
 const v=await fixture(),m=manager([v.id],true),reset=new VendorSyncResetService(m,repo);await m.start();const before=await snapshot(v);
 const event=failure==='vendors'?'UPDATE':'DELETE';await db.query(`CREATE FUNCTION reset_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'secret failure'; END $$`);await db.query(`CREATE TRIGGER reset_fail BEFORE ${event} ON ${failure} FOR EACH ROW EXECUTE FUNCTION reset_fail()`);
 try{await assert.rejects(reset.reset(root,v.id,{}),{code:'VENDOR_RESET_FAILED'});assert.deepEqual(await snapshot(v),before);assert.equal(m.getStatus().length,1);assert.equal(m.getStatus()[0].currentSequence,(before.vendors as any[])[0].last_sequence);}
 finally{await m.stop();await db.query(`DROP TRIGGER reset_fail ON ${failure}`);await db.query('DROP FUNCTION reset_fail()');}
});
test('active batch stop awaited, duplicate reset rejected, refresh held, Vendor B untouched, exactly one restart since0',async()=>{
 const a=await fixture(),b=await fixture(),events=new VendorEvents(),starts:string[]=[],requests:{id:string;since:string|number}[]=[];let release!:()=>void,entered=false,resetEntered=false,held=true;
 const gate=new Promise<void>(r=>release=r);const transport=(v:SyncVendor):ChangesTransport=>{starts.push(v.id);let first=true;return {async changes(since,signal){requests.push({id:v.id,since});if(v.id===a.id&&first&&held){first=false;return {results:[movement('during',101,2)],last_seq:'during'};}return inert.changes(since,signal);},async close(){}};};
 const m=new VendorSyncManager({activeIds:async()=>[a.id,b.id],get:id=>internal.get(id)},credentials,events,options,transport,async(id,batch,signal,ctx)=>{entered=true;await gate;return durable.process(id,batch,signal,ctx);},()=>{},durable.prepare);
 const reset=new VendorSyncResetService(m,repo);try{await m.start();await until(()=>entered);const original=m.withPausedVendor.bind(m);m.withPausedVendor=(id,fn)=>original(id,async()=>{resetEntered=true;return fn();});const pending=reset.reset(root,a.id,{});await delay(30);assert.equal(resetEntered,false);
 await assert.rejects(reset.reset(root,a.id,{}),{code:'VENDOR_RESET_BUSY'});events.publish({vendorId:a.id,changeType:'update',changedFields:['username']});await m.refresh(a.id);assert.equal(starts.filter(id=>id===a.id).length,1);const other=await snapshot(b);
 held=false;release();await pending;await until(()=>requests.some(r=>r.id===a.id&&r.since==='0'));await resetState(a);assert.equal(starts.filter(id=>id===a.id).length,2);assert.equal(starts.filter(id=>id===b.id).length,1);assert.equal(m.getStatus().length,2);assert.deepEqual(await snapshot(b),other);
 }finally{release();await m.stop();}
});
test('worker stop failure prevents DB reset and never starts a second worker',async()=>{
 const v=await fixture(),m=manager([v.id],true);await m.start();const worker=(m as any).workers.get(v.id),stop=worker.stop.bind(worker);worker.stop=async()=>{throw Error('stop failed');};const before=await snapshot(v);
 try{await assert.rejects(new VendorSyncResetService(m,repo).reset(root,v.id,{}),{code:'VENDOR_RESET_FAILED'});assert.deepEqual(await snapshot(v),before);assert.equal(m.getStatus().length,1);}finally{worker.stop=stop;await m.stop();}
});
test('committed reset with failed restart reports warning, keeps reset, then existing retry recovers',async()=>{
 const v=await fixture();let broken=false;const since:(string|number)[]=[];
 const m=new VendorSyncManager({activeIds:async()=>[v.id],async get(id){if(broken)throw Error('DB unavailable');return internal.get(id);}},credentials,new VendorEvents(),options,()=>({async changes(s,signal){since.push(s);return inert.changes(s,signal);},async close(){}}),durable.process,()=>{},durable.prepare);
 const replacement=new VendorsRepository(db),get=replacement.get.bind(replacement);let count=0;replacement.get=async(...args)=>{const row=await get(...args);if(++count===3)broken=true;return row;};
 try{await m.start();const result=await new VendorSyncResetService(m,replacement).reset(root,v.id,{});assert.equal(result.code,'VENDOR_RESET_RESTART_PENDING');await resetState(v);assert.equal(m.getStatus().length,0);broken=false;await until(()=>since.includes('0'));assert.equal(m.getStatus().length,1);}finally{broken=false;await m.stop();}
});
test('inactive reset has no worker; global disabled active reset gives explicit pending warning',async()=>{
 const v=await fixture(),m=manager([v.id],true);await db.query('UPDATE vendors SET is_active=false WHERE id=$1',[v.id]);try{await m.start();assert.equal((await new VendorSyncResetService(m,repo).reset(root,v.id,{})).code,'VENDOR_RESET_COMPLETED');assert.equal(m.getStatus().length,0);await resetState(v);}finally{await m.stop();}
 await db.query('UPDATE vendors SET is_active=true WHERE id=$1',[v.id]);const disabled=manager([v.id]);try{assert.equal((await new VendorSyncResetService(disabled,repo).reset(root,v.id,{})).code,'VENDOR_RESET_RESTART_PENDING');assert.equal(disabled.getStatus().length,0);}finally{await disabled.stop();}
});
test('permission revoked during pause is rechecked and mutation denied',async()=>{
 const v=await fixture(),m=manager([v.id]);await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'vendors.reset_sync','true')",[normal.id]);const before=await snapshot(v),original=m.withPausedVendor.bind(m);
 m.withPausedVendor=(id,fn)=>original(id,async()=>{await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);return fn();});
 try{await assert.rejects(new VendorSyncResetService(m,repo).reset(normal,v.id,{}),{code:'VENDOR_FORBIDDEN'});assert.deepEqual(await snapshot(v),before);}finally{await m.stop();}
});
test('reset never-initialized Vendor binds source and bootstraps main currency from zero on first replay',async()=>{
 const v=await vendor(),m=manager([v.id]);try{await new VendorSyncResetService(m,repo).reset(root,v.id,{});await resetState(v);let page=0;const since:(string|number)[]=[];const transport:ChangesTransport={async changes(s){since.push(s);return ++page===1?{results:references(),last_seq:'references'}:{results:[],last_seq:'references'};},async close(){}};
 assert.equal(await durable.prepare((await internal.get(v.id))!,transport,signal),'0');assert.deepEqual(since,['0','references']);assert.equal((await db.query("SELECT count(*)::int n FROM currencies WHERE vendor_id=$1 AND source_id='z_walyuta-1'",[v.id])).rows[0].n,1);await apply(v,[product(),movement('purchase',101,10)]);assert.equal((await db.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock,'10');}finally{await m.stop();}
});
test('shutdown waits for reset transaction, never restarts worker after shutdown begins',async()=>{
 const v=await fixture(),m=manager([v.id],true);let release!:()=>void,entered=false;const gate=new Promise<void>(r=>release=r);await m.start();const task=m.withPausedVendor(v.id,async()=>{entered=true;await gate;return 1;});await until(()=>entered);let finished=false;const stopping=m.stop().then(()=>{finished=true;});await delay(20);assert.equal(finished,false);release();assert.equal((await task).restartPending,true);await stopping;assert.equal(m.getStatus().length,0);
});

test('production HTTP reset: real CSRF/auth, stopped feed, committed empty state, Nano replay and stable FK', {timeout:20000},async()=>{
 const {createServer}=await import('node:http');const {spawn}=await import('node:child_process');const {once}=await import('node:events');
 await db.query('UPDATE vendors SET is_active=false');
 let releaseReplay=false,zeroRequests=0,closedOld=false;const requests:string[]=[],waiting:(()=>void)[]=[];
 const documents=[...references(),product(),movement('purchase',101,10),movement('sale',201,3)];
 const couch=createServer((req,res)=>{
  const since=new URL(req.url!,'http://local').searchParams.get('since')!;requests.push(since);
  const answer=()=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({results:since==='0'?documents:[],last_seq:'replayed'}));};
  if(since==='0'){zeroRequests++;if(releaseReplay)answer();else waiting.push(answer);}
  else if(since==='replayed'&&zeroRequests===1)answer();
  else res.on('close',()=>{if(since!=='replayed')closedOld=true;});
 });
 couch.listen(0,'127.0.0.1');await once(couch,'listening');
 const v=await vendor();v.url=`http://127.0.0.1:${(couch.address() as any).port}/fixture`;await db.query('UPDATE vendors SET url=$2 WHERE id=$1',[v.id,v.url]);await apply(v,documents);await db.query('INSERT INTO products(source_product_id,name) SELECT id,name FROM source_products WHERE vendor_id=$1',[v.id]);const before=await snapshot(v);
 const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');const port=(portProbe.address() as any).port;await new Promise<void>(r=>portProbe.close(()=>r()));
 const args=process.env.TEST_PRODUCTION==='1'?['dist/server.js']:['--import','tsx','src/server.ts'];
 const child=spawn(process.execPath,args,{env:{...process.env,NODE_ENV:'production',PGOPTIONS:`-c search_path=${schema}`,HOST:'127.0.0.1',PORT:String(port),VENDOR_SYNC_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);const exited=once(child,'exit');const timer=setTimeout(()=>child.kill('SIGKILL'),17000);
 try{await until(()=>output.includes('listening on'));await until(()=>requests.length>0);const session=await new SessionRepository(db).create(root.id),base=`http://127.0.0.1:${port}`,url=base+'/cpanel/api/vendors/'+v.id+'/reset-sync';
 const headers={'Cookie':'__Secure-hormat_cpanel='+session.token,'Content-Type':'application/json','X-CSRF-Token':session.session.csrf_token};
 for(const csrf of ['', 'invalid'])assert.equal((await fetch(url,{method:'POST',headers:{...headers,'X-CSRF-Token':csrf},body:'{}'})).status,403);assert.deepEqual(await snapshot(v),before);
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,Cookie:''},body:'{}',redirect:'manual'})).status,303);
 assert.equal((await fetch(url+'?vendor_id=other',{method:'POST',headers,body:'{}'})).status,400);
 const response=await fetch(url,{method:'POST',headers,body:'{}'});assert.equal(response.status,200);const body=await response.json() as any;assert.equal(body.code,'VENDOR_RESET_COMPLETED');assert.equal(body.row.lastSequence,'0');assert.equal(body.row.lastSync,'—');assert.equal(body.row.lastOperation,'—');
 await until(()=>zeroRequests===1);assert.equal(closedOld,true);await resetState(v);const reset=await snapshot(v);for(const table of ['warehouses','currencies','measures','source_products','product_barcodes','products','transaction_types'])assert.deepEqual(reset[table],before[table]);
 releaseReplay=true;for(const answer of waiting)answer();await until(async()=>(await internal.get(v.id))?.last_sequence==='replayed');assert.equal(zeroRequests,2,'Reference prepass followed by one durable replay from zero');assert.equal((await db.query('SELECT stock FROM product_stocks WHERE vendor_id=$1',[v.id])).rows[0].stock,'7');assert.equal((await db.query('SELECT count(*)::int n FROM source_stock_movements WHERE vendor_id=$1',[v.id])).rows[0].n,2);assert.deepEqual((await snapshot(v)).products,before.products);
 child.kill('SIGTERM');assert.equal((await exited)[0],0);assert.ok(!output.includes(config.vendors.credentialsKey));
 }finally{clearTimeout(timer);if(child.exitCode===null){child.kill('SIGKILL');await exited;}couch.closeAllConnections();await new Promise<void>(r=>couch.close(()=>r()));}
});

test('immediate credential restart failure preserves committed reset and returns safe pending outcome',async()=>{
 const v=await fixture();await db.query('UPDATE vendors SET password_encrypted=$2 WHERE id=$1',[v.id,new VendorCredentials('a'.repeat(64)).encryptSecret('wrong-key-test')]);const m=manager([v.id],true);
 try{await m.start();await until(()=>Boolean(m.getStatus()[0]?.lastError));const result=await new VendorSyncResetService(m,repo).reset(root,v.id,{});assert.equal(result.code,'VENDOR_RESET_RESTART_PENDING');await resetState(v);assert.equal(m.getStatus()[0].lastError,'CREDENTIAL_DECRYPTION');assert.equal(m.getStatus().length,1);}finally{await m.stop();}
});
