import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import pg from 'pg';
import {config} from '../../src/config/env.js';import {pool} from '../../src/database/pool.js';import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {VendorCredentials,validateVendorKey} from '../../src/vendors/credentials.js';import {VendorsRepository,type VendorActor} from '../../src/vendors/repository.js';import {VendorsService,normalizeVendorUrl} from '../../src/vendors/service.js';import {presentVendor} from '../../src/cpanel/vendors/presentation.js';
const schema='vendors_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),repo=new VendorsRepository(db),credentials=new VendorCredentials(randomBytes(32).toString('hex')),service=new VendorsService(repo,credentials);
let root:VendorActor,normal:VendorActor;const body=()=>({name:'Vendor '+randomUUID(),url:'HTTPS://Supplier.Example.invalid:443/database',username:'reader',password:'supplier secret '+randomUUID()});
async function actor(superuser:boolean){const u=await bootstrapSuperuser({name:'Vendor admin',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[u.id]);const session=await new SessionRepository(db).create(u.id);return {id:u.id,sessionHash:session.session.token_hash};}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
const stored=async(id:string)=>(await db.query('SELECT * FROM vendors WHERE id=$1',[id])).rows[0];
test('Vendor migration has exact columns, opaque checkpoint, nullable runtime dates and active default',async()=>{
 const rows=(await db.query("SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='vendors' ORDER BY ordinal_position",[schema])).rows;
 assert.deepEqual(rows.map(r=>r.column_name),['id','name','url','username','password_encrypted','is_active','last_sequence','date_last_sync','date_last_operation','created_at','updated_at']);assert.equal(rows.find(r=>r.column_name==='last_sequence').data_type,'text');
 for(const column of ['date_last_sync','date_last_operation']){assert.equal(rows.find(r=>r.column_name===column).is_nullable,'YES');assert.equal(rows.find(r=>r.column_name===column).data_type,'timestamp with time zone');}assert.equal(rows.find(r=>r.column_name==='is_active').column_default,'true');
 assert.equal((await db.query('SELECT count(*)::int AS count FROM source_products')).rows[0].count,0);
});
test('AES-GCM randomized roundtrip, wrong key/tamper/invalid payload authentication and startup config',()=>{
 const secret='秘密 + original password',one=credentials.encryptSecret(secret),two=credentials.encryptSecret(secret);assert.ok(one!==two);assert.ok(credentials.decryptSecret(one)===secret);assert.ok(!one.includes(secret));
 assert.throws(()=>new VendorCredentials(randomBytes(32).toString('hex')).decryptSecret(one),/decryption failed/);
 const tampered=[1,2,3].map(index=>{const parts=one.split('.'),bytes=Buffer.from(parts[index],'base64url');bytes[0]^=1;parts[index]=bytes.toString('base64url');return parts.join('.');});
 for(const invalid of [...tampered,'bad','v2.'+one.slice(3),one+'.x','v1.a.b.c'])assert.throws(()=>credentials.decryptSecret(invalid),/decryption failed/);
 for(const value of [undefined,'','abc','g'.repeat(64)])assert.throws(()=>validateVendorKey(value),/VENDOR_CREDENTIALS_KEY/);
 for(const value of ['', 'invalid-config-marker']){const child=spawnSync(process.execPath,['--import','tsx','src/server.ts'],{env:{...process.env,VENDOR_SYNC_ENABLED:'false',VENDOR_CREDENTIALS_KEY:value},encoding:'utf8',timeout:10000});assert.notEqual(child.status,0);assert.match(child.stderr,/VENDOR_CREDENTIALS_KEY/);assert.ok(!child.stderr.includes('invalid-config-marker'));}
 assert.equal(validateVendorKey('a'.repeat(64)),'a'.repeat(64));
});
test('create encrypts, read projection hides secrets, empty edit preserves payload; replacement rotates it',async()=>{
 const input=body(),created=await service.mutate(root,'create',undefined,input),id=created.row.id,row=await stored(id);
 assert.equal(row.is_active,true);assert.equal(row.last_sequence,null);assert.equal(row.date_last_sync,null);assert.equal(row.date_last_operation,null);assert.ok(credentials.decryptSecret(row.password_encrypted)===input.password);assert.ok(!JSON.stringify(row).includes(input.password));
 for(const result of [created.row,await service.details(root,id),(await service.list(root,{})).rows]){assert.ok(!JSON.stringify(result).includes('password_encrypted'));assert.ok(!JSON.stringify(result).includes(input.password));}
 const edit={name:'Changed',url:row.url,username:'newreader',password:''};await service.mutate(root,'update',id,edit);assert.ok((await stored(id)).password_encrypted===row.password_encrypted);
 await service.mutate(root,'update',id,{...edit,password:'replacement secret'});assert.ok(credentials.decryptSecret((await stored(id)).password_encrypted)==='replacement secret');assert.ok((await stored(id)).password_encrypted!==row.password_encrypted);
 assert.equal(presentVendor(created.row,'en',key=>key).healthLabel,'cpanel.vendors.notSynced');
});
test('validation, runtime injection and encryption/database failure roll back complete configuration',async()=>{
 const input=body(),id=(await service.mutate(root,'create',undefined,input)).row.id,before=await stored(id);
 for(const field of ['last_sequence','date_last_sync','date_last_operation','sync_health','sync_status','password_encrypted','id','is_active'])for(const op of ['create','update'] as const)await assert.rejects(service.mutate(root,op,op==='create'?undefined:id,{...input,[field]:'injected'}),{code:'VENDOR_INVALID_REQUEST'});
 for(const [patch,code] of [[{name:''},'VENDOR_INVALID_NAME'],[{username:''},'VENDOR_INVALID_USERNAME'],[{password:''},'VENDOR_PASSWORD_REQUIRED'],[{url:'https://user:secret@example.invalid/db'},'VENDOR_INVALID_URL']] as const)await assert.rejects(service.mutate(root,'create',undefined,{...input,...patch}),{code});
 const broken=new VendorsService(repo,{encryptSecret(){throw new Error('private crypto failure');}} as VendorCredentials);await assert.rejects(broken.mutate(root,'update',id,{...input,password:'new'}),{code:'VENDOR_UPDATE_FAILED'});assert.ok(JSON.stringify(await stored(id))===JSON.stringify(before));assert.ok(credentials.decryptSecret((await stored(id)).password_encrypted)===input.password);
 await db.query(`CREATE FUNCTION vendors_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$`);await db.query('CREATE TRIGGER vendors_fail BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION vendors_fail()');
 try{await assert.rejects(service.mutate(root,'update',id,{...input,password:'new'}),{code:'VENDOR_UPDATE_FAILED'});assert.ok(JSON.stringify(await stored(id))===JSON.stringify(before));assert.ok(credentials.decryptSecret((await stored(id)).password_encrypted)===input.password);}finally{await db.query('DROP TRIGGER vendors_fail ON vendors');await db.query('DROP FUNCTION vendors_fail()');}
});
test('URL normalization is predictable, rejects embedded credentials and unsupported URLs',()=>{
 assert.equal(normalizeVendorUrl('  HTTPS://EXAMPLE.invalid:443/db/path/  '),'https://example.invalid/db/path/');assert.equal(normalizeVendorUrl('http://localhost:5984/db'),'http://localhost:5984/db');
 for(const value of ['ftp://example.invalid/db','file:///tmp/db','https://u:p@example.invalid/db','https://u@example.invalid/db','https://example.invalid/db?password=x','https://example.invalid/db#x','http:example.invalid','https://example.invalid/space path','not a url'])assert.throws(()=>normalizeVendorUrl(value),{code:'VENDOR_INVALID_URL'});
});
test('real search allowlist/defaults, literal wildcard and status preserve all runtime/credential fields',async()=>{
 const input=body(),created=await service.mutate(root,'create',undefined,input),id=created.row.id;
 await db.query("UPDATE vendors SET last_sequence='opaque-xyz',date_last_sync='2026-09-16T10:00:00Z',date_last_operation='2026-09-16T10:00:03Z' WHERE id=$1",[id]);const before=await stored(id);
 await service.mutate(root,'status',id,{status:'inactive'});const after=await stored(id);for(const key of ['password_encrypted','last_sequence','date_last_sync','date_last_operation'])assert.ok(JSON.stringify(after[key])===JSON.stringify(before[key]));
 assert.equal((await service.list(root,{query:input.name})).total,0);assert.equal((await service.list(root,{query:input.name,status:'inactive'})).total,1);
 await service.mutate(root,'status',id,{status:'active'});
 for(const [field,query] of [['name',input.name],['url','supplier.example.invalid'],['username','reader'],['all',input.name]])assert.ok((await service.list(root,{field,query,status:'all'})).total>0);
 assert.equal((await service.list(root,{field:'all',query:input.password})).total,0);assert.equal((await service.list(root,{field:'all',query:'%_'})).total,0);await assert.rejects(service.list(root,{field:'password_encrypted'}),{code:'VENDOR_INVALID_REQUEST'});
 const page=presentVendor(await service.details(root,id),'en',key=>key);assert.equal(page.lastSequence,'opaque-xyz');assert.equal(page.healthLabel,'cpanel.vendors.healthPending');assert.equal(page.lag,'3 cpanel.vendors.seconds');
});
test('four permissions are strict/independent; revoked sessions fail; Super User needs no vendor grant',async()=>{
 const id=(await service.mutate(root,'create',undefined,body())).row.id;
 const calls={view:()=>service.list(normal,{}),create:()=>service.mutate(normal,'create',undefined,body()),update:()=>service.mutate(normal,'update',id,{...body(),password:''}),status:()=>service.mutate(normal,'status',id,{status:'active'})};
 for(const permission of Object.keys(calls))for(const value of [undefined,false,'true',1,null,true]){
  await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3::jsonb)',[normal.id,'vendors.'+permission,JSON.stringify(value)]);
  for(const [key,call] of Object.entries(calls)){if(value===true&&key===permission)await call();else await assert.rejects(call(),{code:'VENDOR_FORBIDDEN'});}
 }
 await assert.rejects(service.list({...root,sessionHash:'invalid'},{}),{code:'VENDOR_FORBIDDEN'});assert.deepEqual((await db.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows,[{key:'superuser',value:true}]);
});

test('configuration CRUD performs no CouchDB network requests',async()=>{
 let requests=0;const server=createServer((_request,response)=>{requests++;response.end('{}');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const address=server.address() as {port:number};const input={...body(),url:`http://127.0.0.1:${address.port}/database`};const id=(await service.mutate(root,'create',undefined,input)).row.id;await service.mutate(root,'update',id,{...input,password:''});await service.mutate(root,'status',id,{status:'inactive'});await service.details(root,id);await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,0);}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('configuration edits preserve runtime; duplicate identities allowed; only primary key index exists',async()=>{
 const input=body(),id=(await service.mutate(root,'create',undefined,input)).row.id;
 const duplicate=(await service.mutate(root,'create',undefined,input)).row.id;assert.notEqual(id,duplicate);
 const indexes=(await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename='vendors'",[schema])).rows;
 assert.equal(indexes.length,1);assert.match(indexes[0].indexdef,/UNIQUE INDEX .* USING btree \(id\)/);
 await db.query("UPDATE vendors SET last_sequence='opaque-config-preserved',date_last_sync='2026-09-16T10:00:00Z',date_last_operation='2026-09-16T10:00:03Z' WHERE id=$1",[id]);const before=await stored(id);
 for(const password of ['', 'replacement']){await service.mutate(root,'update',id,{name:'Renamed',url:'https://different.example.invalid/products-db',username:'another',password});const after=await stored(id);for(const key of ['last_sequence','date_last_sync','date_last_operation'])assert.deepEqual(after[key],before[key]);}
 assert.ok(credentials.decryptSecret((await stored(id)).password_encrypted)==='replacement');
 assert.equal(normalizeVendorUrl('https://supplier.example.com/products-db'),'https://supplier.example.com/products-db');
});

test('post-commit Vendor events are safe; rollback emits nothing; listener batches never mutate PostgreSQL',async()=>{
 const {VendorEvents}=await import('../../src/vendors/events.js');
 const {VendorSyncRepository}=await import('../../src/vendors/sync/repository.js');
 const {VendorSyncManager}=await import('../../src/vendors/sync/manager.js');
 const {syncOptions}=await import('../../src/vendors/sync/config.js');
 const {setTimeout:delay}=await import('node:timers/promises');
 const events=new VendorEvents(),mutations=new VendorsService(repo,credentials,events),observed:any[]=[],committed:Promise<boolean>[]=[];
 const unsubscribe=events.subscribe(event=>{observed.push(event);committed.push(db.query('SELECT 1 FROM vendors WHERE id=$1',[event.vendorId]).then(result=>result.rowCount===1));});
 const input=body();const created=await mutations.mutate(root,'create',undefined,input);const id=created.row.id;
 assert.deepEqual(Object.keys(observed[0]).sort(),['changeType','changedFields','vendorId']);assert.ok((await Promise.all(committed)).every(Boolean));
 assert.ok(!JSON.stringify(observed).includes(input.password));assert.ok(!JSON.stringify(observed).includes('encrypted'));
 await mutations.mutate(root,'update',id,{...input,name:'Only name changes',password:''});assert.deepEqual(observed.at(-1).changedFields,['name']);
 const count=observed.length;
 await assert.rejects(mutations.mutate(root,'update',id,{...input,url:'bad'}));assert.equal(observed.length,count);
 // A deferred trigger fails at COMMIT, after the UPDATE has run successfully.
 await db.query(`CREATE FUNCTION fail_vendor_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled failure'; END $$`);
 await db.query(`CREATE CONSTRAINT TRIGGER fail_vendor_commit AFTER UPDATE ON vendors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_vendor_commit()`);
 try{await assert.rejects(mutations.mutate(root,'status',id,{status:'inactive'}),{code:'VENDOR_STATUS_FAILED'});assert.equal(observed.length,count);assert.equal((await stored(id)).is_active,true);}
 finally{await db.query('DROP TRIGGER fail_vendor_commit ON vendors');await db.query('DROP FUNCTION fail_vendor_commit()');}
 await db.query("UPDATE vendors SET last_sequence='existing-opaque',date_last_sync='2026-09-16T10:00:00Z',date_last_operation='2026-09-16T10:00:01Z' WHERE id=$1",[id]);
 const internal=new VendorSyncRepository(db),since:(string|number)[]=[];
 // Restrict the test manager to this fixture; never load or contact application Vendors.
 const manager=new VendorSyncManager({activeIds:async()=>[id],get:key=>internal.get(key)},credentials,events,{...syncOptions({}),enabled:true},()=>{
  let first=true;return {async changes(sequence,signal){since.push(sequence);if(first){first=false;return {results:[{id:'source-doc',doc:{name:'Not persisted'}}],last_seq:'new-memory-only'};}await delay(100000,undefined,{signal});throw Error();},async close(){}};
 },undefined,()=>{});
 async function snapshot(){const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",[schema])).rows;const result:Record<string,string>={};for(const {tablename} of tables){result[tablename]=(await db.query(`SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text AS value FROM "${tablename}" t`)).rows[0].value;}return result;}
 const before=await snapshot();
 try{await manager.start();for(let i=0;i<100&&manager.getStatus()[0]?.currentSequence!=='new-memory-only';i++)await delay(5);
 assert.equal(manager.getStatus()[0]?.currentSequence,'new-memory-only');assert.equal(since[0],'existing-opaque');
 assert.ok(JSON.stringify(await snapshot())===JSON.stringify(before),'All isolated database tables must remain unchanged');
 assert.equal((await db.query('SELECT count(*)::int AS count FROM source_products')).rows[0].count,0);
 await mutations.mutate(root,'status',id,{status:'inactive'});await manager.refresh(id);assert.equal(manager.getStatus().length,0);
 await mutations.mutate(root,'status',id,{status:'active'});await manager.refresh(id);assert.equal(manager.getStatus().length,1);
 }finally{await manager.stop();unsubscribe();}
});

test('production server starts enabled listeners only against local fixture and SIGTERM aborts longpoll', {timeout:15000},async()=>{
 const {spawn}=await import('node:child_process');const {once}=await import('node:events');const {setTimeout:delay}=await import('node:timers/promises');
 const runtimeKey=randomBytes(32).toString('hex'),cipher=new VendorCredentials(runtimeKey);
 // This schema belongs exclusively to this test file; prevent every earlier fixture from starting.
 await db.query('UPDATE vendors SET is_active=false');
 let requests=0,aborted=false;
 const couch=createServer((_req,res)=>{requests++;if(requests<=3){res.setHeader('content-type','application/json');res.end(JSON.stringify({results:requests===2?[]:[{id:'local-only',doc:{_id:'local-only',$dokuman_tipi:'depo',Adi:'Local fixture'}}],last_seq:'runtime-test'}));}else res.on('close',()=>{aborted=true;});});
 couch.listen(0,'127.0.0.1');await once(couch,'listening');
 const url=`http://127.0.0.1:${(couch.address() as {port:number}).port}/database`;
 await db.query('INSERT INTO vendors(name,url,username,password_encrypted) VALUES($1,$2,$3,$4)',['Lifecycle test',url,'test-only',cipher.encryptSecret('test-only')]);
 const before=await db.query('SELECT last_sequence,date_last_sync,date_last_operation FROM vendors ORDER BY id');
 const args=process.env.TEST_PRODUCTION==='1'?['dist/server.js']:['--import','tsx','src/server.ts'];
 const child=spawn(process.execPath,args,{env:{...process.env,PGOPTIONS:`-c search_path=${schema}`,HOST:'127.0.0.1',PORT:'3118',VENDOR_CREDENTIALS_KEY:runtimeKey,VENDOR_SYNC_ENABLED:'true'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
 const exited=once(child,'exit');const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
 try{for(let i=0;i<150&&requests<4&&child.exitCode===null;i++)await delay(30);
 assert.ok(requests>=4,'Enabled production server must bootstrap, commit and continue its local CouchDB feed');assert.ok(output.includes('listening on'));
 child.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);assert.equal(aborted,true);assert.ok(!output.includes(runtimeKey));
 const after=(await db.query('SELECT last_sequence,date_last_sync,date_last_operation FROM vendors ORDER BY id')).rows;assert.deepEqual(after.slice(0,-1),before.rows.slice(0,-1));assert.equal(after.at(-1).last_sequence,'runtime-test');assert.ok(after.at(-1).date_last_sync);assert.equal(after.at(-1).date_last_operation,null);assert.equal((await db.query("SELECT count(*)::int n FROM warehouses WHERE source_id='local-only'")).rows[0].n,1);
 const beforeDisabled=requests;
 const disabled=spawn(process.execPath,args,{env:{...process.env,PGOPTIONS:`-c search_path=${schema}`,HOST:'127.0.0.1',PORT:'3118',VENDOR_CREDENTIALS_KEY:runtimeKey,VENDOR_SYNC_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 let disabledOutput='';disabled.stdout.on('data',data=>{disabledOutput+=data;});disabled.stderr.on('data',data=>{disabledOutput+=data;});
 const disabledExit=once(disabled,'exit');const disabledTimer=setTimeout(()=>disabled.kill('SIGKILL'),5000);
 try{for(let i=0;i<100&&!disabledOutput.includes('listening on')&&disabled.exitCode===null;i++)await delay(20);
 assert.ok(disabledOutput.includes('listening on'));assert.equal((await fetch('http://127.0.0.1:3118/health')).status,200);await delay(100);assert.equal(requests,beforeDisabled,'Disabled server must not contact the active local Vendor');
 disabled.kill('SIGTERM');assert.equal((await disabledExit)[0],0);
 }finally{clearTimeout(disabledTimer);if(disabled.exitCode===null){disabled.kill('SIGKILL');await disabledExit;}}
 }finally{clearTimeout(timer);if(child.exitCode===null){child.kill('SIGKILL');await exited;}couch.closeAllConnections();await new Promise<void>(r=>couch.close(()=>r()));}
});

test('real committed CRUD drives active/inactive create, edits, rollback, rapid convergence and deactivation without manual refresh',async()=>{
 const {VendorEvents}=await import('../../src/vendors/events.js');const {VendorSyncRepository}=await import('../../src/vendors/sync/repository.js');
 const {VendorSyncManager}=await import('../../src/vendors/sync/manager.js');const {syncOptions}=await import('../../src/vendors/sync/config.js');const {setTimeout:delay}=await import('node:timers/promises');
 const events=new VendorEvents(),mutations=new VendorsService(repo,credentials,events),internal=new VendorSyncRepository(db);
 const logs:any[]=[],notifications:any[]=[],connections:any[]=[],live=new Map<string,number>(),requests=new Map<string,number>();
 const unsubscribe=events.subscribe(event=>notifications.push(event));
 const manager=new VendorSyncManager({activeIds:async()=>[],get:id=>internal.get(id)},credentials,events,{...syncOptions({}),enabled:true},(row,password)=>{
 const record={id:row.id,url:row.url,username:row.username,password,firstSince:undefined as string|number|undefined,aborted:false};connections.push(record);
 live.set(row.id,(live.get(row.id)??0)+1);assert.equal(live.get(row.id),1,'Old connection must close before replacement');let first=true;
 return {async changes(since,signal){requests.set(row.id,(requests.get(row.id)??0)+1);
 if(first){first=false;record.firstSince=since;return {results:[{id:'gone',deleted:true},{id:'_design/example',doc:{views:{}}}],last_seq:'memory-Z'};}
 try{await delay(100000,undefined,{signal});throw Error();}finally{record.aborted=signal.aborted;}},async close(){live.set(row.id,live.get(row.id)!-1);}};
 },undefined,(e,f)=>logs.push({e,...f}));
 async function wait(check:()=>boolean){for(let n=0;n<300&&!check();n++)await delay(5);assert.ok(check(),'Lifecycle event did not converge');}
 const latest=(id:string)=>connections.filter(c=>c.id===id).at(-1);
 const syncState=async()=> (await db.query('SELECT id,last_sequence,date_last_sync,date_last_operation FROM vendors ORDER BY id')).rows;
 try{await manager.start();const a=body(),b={...body(),status:'inactive'};
 const id=(await mutations.mutate(root,'create',undefined,a)).row.id;await wait(()=>manager.getStatus().some(s=>s.vendorId===id&&s.currentSequence==='memory-Z'));
 const other=(await mutations.mutate(root,'create',undefined,b)).row.id;await delay(30);assert.equal(connections.some(c=>c.id===other),false);
 await db.query("UPDATE vendors SET last_sequence='persisted-X',date_last_sync='2026-09-16T10:00:00Z',date_last_operation='2026-09-16T10:00:01Z' WHERE id=$1",[other]);
 const before=await syncState();await mutations.mutate(root,'status',other,{status:'active'});await wait(()=>latest(other)?.firstSince==='persisted-X');
 const original=latest(id),count=connections.length;
 await mutations.mutate(root,'update',id,{...a,name:'Name only',password:''});await delay(40);assert.equal(connections.length,count);assert.equal(latest(id),original);
 const replacement='replacement-'+randomUUID();await mutations.mutate(root,'update',id,{...a,password:replacement});await wait(()=>connections.length===count+1);
 assert.equal(original.aborted,true);assert.ok(latest(id).password===replacement);assert.equal(latest(id).firstSince,'memory-Z');
 await mutations.mutate(root,'update',id,{...a,username:'changed-reader',password:''});await wait(()=>latest(id)?.username==='changed-reader');assert.equal(latest(id).firstSince,'memory-Z');
 const changed={...a,url:'https://new-source.example.invalid/db',username:'changed-reader',password:''};await mutations.mutate(root,'update',id,changed);await wait(()=>latest(id)?.url===changed.url);assert.equal(latest(id).firstSince,'0');
 const previous=latest(id),eventCount=notifications.length;
 await db.query(`CREATE FUNCTION fail_live_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled'; END $$`);
 await db.query(`CREATE CONSTRAINT TRIGGER fail_live_commit AFTER UPDATE ON vendors DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_live_commit()`);
 try{await assert.rejects(mutations.mutate(root,'update',id,{...changed,username:'must-rollback'}),{code:'VENDOR_UPDATE_FAILED'});await delay(30);assert.equal(notifications.length,eventCount);assert.equal(latest(id),previous);assert.equal(live.get(id),1);}
 finally{await db.query('DROP TRIGGER fail_live_commit ON vendors');await db.query('DROP FUNCTION fail_live_commit()');}
 for(let i=0;i<6;i++)await mutations.mutate(root,'update',id,{...changed,username:'rapid-'+i,url:`https://rapid.example.invalid/db${i}`,password:'rapid-secret-'+i});
 await wait(()=>latest(id)?.username==='rapid-5');assert.ok(latest(id).password==='rapid-secret-5');assert.equal(latest(id).url,'https://rapid.example.invalid/db5');assert.equal(live.get(id),1);
 assert.equal(manager.getStatus().length,2);const stopped=latest(id);await mutations.mutate(root,'status',id,{status:'inactive'});await wait(()=>!manager.getStatus().some(s=>s.vendorId===id));
 const requestCount=requests.get(id);await delay(50);assert.equal(requests.get(id),requestCount);assert.equal(stopped.aborted,true);assert.equal(live.get(id),0);assert.equal(live.get(other),1);
 const status=manager.getStatus()[0];assert.equal(status.counts.designDocuments,1);assert.equal(status.counts.deletions,1);
 assert.deepEqual(await syncState(),before);
 for(const event of notifications)assert.deepEqual(Object.keys(event).sort(),['changeType','changedFields','vendorId']);
 const visible=JSON.stringify([notifications,logs,manager.getStatus()]);for(const secret of [a.password,b.password,replacement,'rapid-secret-',(await stored(id)).password_encrypted])assert.ok(!visible.includes(secret));
 }finally{await manager.stop();unsubscribe();}assert.ok([...live.values()].every(value=>value===0));
});
