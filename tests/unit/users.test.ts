import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { pool } from '../../src/database/pool.js';
import { migrate } from '../../src/database/migrate.js';
import { bootstrapSuperuser } from '../../src/cpanel/auth/bootstrap.js';
import { SessionRepository } from '../../src/cpanel/auth/sessions.js';
import { UsersRepository,type Actor } from '../../src/cpanel/users/repository.js';
import { UsersService,type Operation } from '../../src/cpanel/users/service.js';
import { verifyPassword } from '../../src/cpanel/auth/password.js';
import { MediaStore } from '../../src/media/store.js';
const schema=`users_test_${randomUUID().replaceAll('-','')}`;
const db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const repository=new UsersRepository(db),service=new UsersService(repository),sessions=new SessionRepository(db);
let root:Actor,normal:Actor,target:string;
const profile=(extra={})=>({name:'Ali Demo',phone:'000123',job:'Catalog manager',email:`${randomUUID()}@example.invalid`,password:'Valid test password 123',confirm:'Valid test password 123',...extra});
const snapshot=async()=>Promise.all(['cpanel_users','cpanel_user_auth','cpanel_user_permissions','cpanel_sessions'].map(async table=>(await db.query(`SELECT to_jsonb(t) FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
async function actor(superuser:boolean){const a=await bootstrapSuperuser({name:'Actor',email:`${randomUUID()}@example.invalid`,password:'Actor password 123'},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[a.id]);const session=await sessions.create(a.id);return {id:a.id,sessionHash:session.session.token_hash};}
async function permission(key:string,value:unknown){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);target=(await service.mutate(root,'create',undefined,profile())).id;});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('status migration backfills existing accounts, retains Super User and defaults new accounts active',async()=>{
 await db.query('ALTER TABLE cpanel_user_auth DROP COLUMN is_active');
 await db.query(await readFile('src/database/migrations/013_cpanel_auth_status.sql','utf8'));
 assert.equal((await db.query('SELECT count(*) FROM cpanel_user_auth WHERE NOT is_active')).rows[0].count,'0');
 assert.equal((await db.query("SELECT count(*) FROM information_schema.columns WHERE table_schema=$1 AND table_name='cpanel_users' AND column_name='is_active'",[schema])).rows[0].count,'0');
 const made=await service.mutate(root,'create',undefined,profile());assert.equal((await db.query('SELECT is_active FROM cpanel_user_auth WHERE user_id=$1',[made.id])).rows[0].is_active,true);
});
test('every Users permission is independent, missing/false/non-boolean deny; exact Super User bypass',async()=>{
 const operations:Operation[]=['create','update','status','change_password'];
 const call=(key:string)=>key==='view'?service.list(normal,{}):service.mutate(normal,key as Operation,key==='create'?undefined:target,key==='status'?{status:'active'}:key==='change_password'?{password:'Different password 123',confirm:'Different password 123'}:key==='update'?{name:'Updated',phone:'1',job:'Job',email:'updated@example.invalid'}:profile());
 for(const key of ['view',...operations]){
  for(const value of [undefined,false,'true',1,{},null]){await permission(`users.${key}`,value);const before=await snapshot();await assert.rejects(call(key),{code:'forbidden'});assert.deepEqual(await snapshot(),before);}
  await permission(`users.${key}`,true);await call(key);
  for(const other of ['view',...operations].filter(other=>other!==key))await assert.rejects(call(other),{code:'forbidden'});
 }
 for(const value of ['true',1,{},null,false]){await permission('superuser',value);await assert.rejects(call('view'),{code:'forbidden'});}
 await permission('superuser',true);for(const key of ['view',...operations])await call(key);
 assert.deepEqual((await db.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[normal.id])).rows,[{key:'superuser',value:true}]);
 await permission('users.view',true);await call('view');await permission('users.view',false);await assert.rejects(call('view'),{code:'forbidden'});
});
test('target protection overrides all actor permissions, self-deactivation denied, malicious fields cannot grant permissions',async()=>{
 for(const targetId of [root.id,normal.id]){
  if(targetId===normal.id)await permission('superuser',true);
  for(const operation of ['update','status','change_password'] as Operation[]){const before=await snapshot();await assert.rejects(service.mutate(root,operation,targetId,{}),{code:'protected'});assert.deepEqual(await snapshot(),before);}
 }
 await permission('users.status',true);await assert.rejects(service.mutate(normal,'status',normal.id,{status:'inactive'}),{code:'selfDeactivate'});
 for(const operation of ['create','update','status','change_password'] as Operation[]){for(const key of ['permissions','superuser','users.create','users.update','users.status','users.change_password','destination','avatarUrl']){const before=await snapshot();await assert.rejects(service.mutate(root,operation,operation==='create'?undefined:target,{[key]:true}),{code:'invalidRequest'});assert.deepEqual(await snapshot(),before);}}
 await assert.rejects(service.mutate(root,'update','9223372036854775807',{}),{code:'notFound'});
});
test('real parameterized partial search, status defaults and bounded pagination',async()=>{
 const one=await service.mutate(root,'create',undefined,profile({name:'Needle Name',phone:'991199',job:'Editor',email:'needle@example.invalid'}));
 await service.mutate(root,'create',undefined,profile({name:'Needle Inactive',status:'inactive'}));
 for(const [field,query] of [['name','nEeDlE'],['phone','1199'],['email','NEEDLE@'],['job','dit'],['all','1199']])assert.ok((await service.list(root,{field,query})).rows.some(row=>row.id===one.id));
 assert.equal((await service.list(root,{query:'Needle'})).total,1);
 assert.equal((await service.list(root,{query:'Needle',status:'all'})).total,2);
 assert.equal((await service.list(root,{query:'Needle',status:'inactive'})).total,1);
 for(const field of ['name; DROP TABLE cpanel_users;--',['name'],'unknown'])await assert.rejects(service.list(root,{field}),{code:'invalidRequest'});
 assert.equal((await service.list(root,{query:"%' OR true --"})).total,0);
 const many=await Promise.all(Array.from({length:10},()=>service.mutate(root,'create',undefined,profile({name:'Page sample'}))));
 const first=await service.list(root,{query:'Page sample'}),second=await service.list(root,{query:'Page sample',page:'2'});assert.equal(first.rows.length,9);assert.equal(second.rows.length,1);assert.equal(first.total,10);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,many.length);
});
test('creation/update isolation, hashing, uniqueness, status/password invalidate only target sessions',async()=>{
 const values=profile({email:' NORMALIZED@EXAMPLE.INVALID '});const user=await service.mutate(root,'create',undefined,values);
 const auth=(await db.query('SELECT * FROM cpanel_user_auth WHERE user_id=$1',[user.id])).rows[0];assert.equal(auth.email,'normalized@example.invalid');assert.ok(await verifyPassword(auth.password_hash,values.password));assert.equal((await db.query('SELECT * FROM cpanel_user_permissions WHERE user_id=$1',[user.id])).rowCount,0);
 await assert.rejects(service.mutate(root,'create',undefined,values),{code:'duplicateEmail'});
 const t1=await sessions.create(user.id),t2=await sessions.create(user.id),unrelated=await sessions.create(root.id);
 await service.mutate(root,'update',user.id,{name:'Edited',phone:'5',job:'Manager',email:'edited@example.invalid'});
 const updated=(await db.query('SELECT * FROM cpanel_user_auth WHERE user_id=$1',[user.id])).rows[0];assert.equal(updated.password_hash,auth.password_hash);assert.equal(updated.is_active,true);
 await service.mutate(root,'status',user.id,{status:'inactive'});assert.equal(await sessions.find(t1.token),undefined);assert.equal(await sessions.find(t2.token),undefined);assert.ok(await sessions.find(unrelated.token));await assert.rejects(sessions.create(user.id));
 await service.mutate(root,'status',user.id,{status:'active'});assert.equal(await sessions.find(t1.token),undefined);
 const t3=await sessions.create(user.id);await service.mutate(root,'change_password',user.id,{password:'Replacement password 123',confirm:'Replacement password 123'});assert.equal(await sessions.find(t3.token),undefined);assert.ok(await sessions.find(unrelated.token));
 const hash=(await db.query('SELECT password_hash FROM cpanel_user_auth WHERE user_id=$1',[user.id])).rows[0].password_hash;assert.equal(await verifyPassword(hash,values.password),false);assert.equal(await verifyPassword(hash,'Replacement password 123'),true);
 const t4=await sessions.create(user.id);await db.query('UPDATE cpanel_user_auth SET is_active=false WHERE user_id=$1',[user.id]);assert.equal(await sessions.find(t4.token),undefined);
});
test('auth failure rolls back user creation and media promotion is compensated; protected/denied do not finalize',async()=>{
 const calls:string[]=[];
 const media={finalizeCachedMedia:async()=>{calls.push('finalize');return {url:'/media/users/avatars/test.png'};},deleteManagedFile:async(url:string)=>{calls.push(url);}} as unknown as MediaStore;
 const tested=new UsersService(repository,media);
 await db.query("CREATE FUNCTION reject_users_auth() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.email='fail@example.invalid' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$");
 await db.query('CREATE TRIGGER reject_auth BEFORE INSERT ON cpanel_user_auth FOR EACH ROW EXECUTE FUNCTION reject_users_auth()');
 const before=await snapshot();await assert.rejects(tested.mutate(root,'create',undefined,profile({email:'fail@example.invalid',avatarCacheToken:'token'})),{code:'failure'});assert.deepEqual(await snapshot(),before);assert.deepEqual(calls,['finalize','/media/users/avatars/test.png']);
 calls.length=0;await assert.rejects(tested.mutate(root,'update',root.id,{avatarCacheToken:'token'}),{code:'protected'});assert.deepEqual(calls,[]);
 await db.query('DROP TRIGGER reject_auth ON cpanel_user_auth');
});
