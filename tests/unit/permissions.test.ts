import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {AuthRepository} from '../../src/cpanel/auth/repository.js';
import {PermissionContext} from '../../src/cpanel/auth/permissions.js';
import {PermissionsRepository,type PermissionActor} from '../../src/cpanel/permissions/repository.js';
import {PermissionsService} from '../../src/cpanel/permissions/service.js';
import {booleanPermissionKeys,permissionDefinitions} from '../../src/cpanel/permissions/definitions.js';
const schema=`permissions_test_${randomUUID().replaceAll('-','')}`;
const db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const sessions=new SessionRepository(db),service=new PermissionsService(new PermissionsRepository(db));
let root:PermissionActor,normal:PermissionActor,target:PermissionActor;
const body=(on:string[]=[])=>({permissions:Object.fromEntries(booleanPermissionKeys.map(key=>[key,on.includes(key)]))});
const snapshot=async()=> (await db.query('SELECT * FROM cpanel_user_permissions ORDER BY user_id,key')).rows;
const grant=async(id:string,key:string,value:unknown)=>db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value',[id,key,JSON.stringify(value)]);
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Permissions actor',email:`${randomUUID()}@example.invalid`,password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);const session=await sessions.create(user.id);return {id:user.id,sessionHash:session.session.token_hash};}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);target=await actor(false);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});

test('registry has twelve assignable booleans and non-assignable Super User; root needs no explicit grants',async()=>{
 assert.equal(booleanPermissionKeys.length,12);assert.equal(new Set(booleanPermissionKeys).size,12);
 assert.equal(permissionDefinitions.flatMap(group=>group.permissions).find(item=>item.key==='superuser')?.assignable,false);
 await service.save(root,target.id,body(booleanPermissionKeys));
 assert.deepEqual((await db.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows,[{key:'superuser',value:true}]);
});
test('strict independent update permission and authoritative active-session validation',async()=>{
 for(const key of ['permissions.view','permissions.update','superuser'])for(const value of [undefined,false,'true',1,{},[],null,true]){
  await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await grant(normal.id,key,value);
  const before=await snapshot();
  if(value===true&&key!=='permissions.view')await service.save(normal,target.id,body());
  else {await assert.rejects(service.save(normal,target.id,body()),{code:'forbidden',status:403});assert.deepEqual(await snapshot(),before);}
 }
 await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await grant(normal.id,'permissions.update',true);
 await assert.rejects(service.save({...normal,sessionHash:'0'.repeat(64)},target.id,body()),{code:'forbidden'});
 await db.query('UPDATE cpanel_user_auth SET is_active=false WHERE user_id=$1',[normal.id]);await assert.rejects(service.save(normal,target.id,body()),{code:'forbidden'});await db.query('UPDATE cpanel_user_auth SET is_active=true WHERE user_id=$1',[normal.id]);
});
test('self-edit and all Super User targets are protected; another administrator can manage normal actor',async()=>{
 await grant(normal.id,'permissions.update',true);await grant(normal.id,'permissions.view',true);
 const before=await snapshot();await assert.rejects(service.save(normal,normal.id,body()),{code:'selfEdit'});
 for(const actor of [root,normal])await assert.rejects(service.save(actor,root.id,body()),{code:'protected'});
 assert.deepEqual(await snapshot(),before);await service.save(root,normal.id,body(['permissions.update']));
});
test('full-form allowlist rejects system/unknown keys, missing fields, wrong types and target overrides without writes',async()=>{
 const cases:unknown[]=[null,[],{},true,{permissions:[]},{permissions:null},{permissions:{}},{permissions:{...body().permissions,superuser:true}},{permissions:{...body().permissions,superuser:false}},{permissions:{...body().permissions,'unknown.permission':true}},{...body(),user_id:root.id},{...body(),target:root.id},{superuser:true}];
 for(const value of ['true',1,{},[],null])cases.push({permissions:{...body().permissions,'users.view':value}});
 for(const input of cases){const before=await snapshot();await assert.rejects(service.save(root,target.id,input),{code:'invalidRequest'});assert.deepEqual(await snapshot(),before);}
 for(const id of ['0','01','-1','abc','9223372036854775808','9223372036854775807'])await assert.rejects(service.save(root,id,body()),{code:'notFound'});
});
test('ON upserts true, OFF deletes, invalid values normalize and unmanaged/system rows remain exact',async()=>{
 await service.save(root,target.id,body());
 await grant(target.id,'superuser',false);await grant(target.id,'system.test',{limit:42});await grant(target.id,'future.unknown','keep');
 const unmanaged=(await db.query("SELECT * FROM cpanel_user_permissions WHERE user_id=$1 AND key IN ('superuser','system.test','future.unknown') ORDER BY key",[target.id])).rows;
 for(const value of [false,'true',12,{},null]){
  await grant(target.id,'users.view',value);await grant(target.id,'users.create',value);
  await service.save(root,target.id,body(['users.view','permissions.view','permissions.update']));
  assert.equal((await db.query("SELECT value FROM cpanel_user_permissions WHERE user_id=$1 AND key='users.view'",[target.id])).rows[0].value,true);
  assert.equal((await db.query("SELECT value FROM cpanel_user_permissions WHERE user_id=$1 AND key='users.create'",[target.id])).rowCount,0);
 }
 for(const key of booleanPermissionKeys){await service.save(root,target.id,body([key]));assert.equal(await new PermissionContext(target.id,new AuthRepository(db)).hasPermission(key),true);await service.save(root,target.id,body());assert.equal(await new PermissionContext(target.id,new AuthRepository(db)).hasPermission(key),false);}
 assert.deepEqual((await db.query("SELECT * FROM cpanel_user_permissions WHERE user_id=$1 AND key IN ('superuser','system.test','future.unknown') ORDER BY key",[target.id])).rows,unmanaged);
});
test('database failure after deletes rolls the complete multi-permission transaction back',async()=>{
 await service.save(root,target.id,body(['permissions.view']));const before=await snapshot();
 await db.query(`CREATE FUNCTION fail_permission_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key='users.create' THEN RAISE EXCEPTION 'injected permission failure'; END IF; RETURN NEW; END $$`);
 await db.query('CREATE TRIGGER fail_permission_save BEFORE INSERT ON cpanel_user_permissions FOR EACH ROW EXECUTE FUNCTION fail_permission_save()');
 try {await assert.rejects(service.save(root,target.id,body(['users.view','users.create'])),{code:'failure',status:500});assert.deepEqual(await snapshot(),before);}
 finally {await db.query('DROP TRIGGER fail_permission_save ON cpanel_user_permissions');await db.query('DROP FUNCTION fail_permission_save()');}
});
test('concurrent revocation and target promotion are rechecked after auth-row lock; complete saves serialize',async()=>{
 await grant(normal.id,'permissions.update',true);
 const client=await db.connect();
 try {
  await client.query('BEGIN');await client.query('SELECT user_id FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[normal.id]);
  await client.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='permissions.update'",[normal.id]);
  const pending=assert.rejects(service.save(normal,target.id,body()),{code:'forbidden'});
  await client.query('COMMIT');await pending;
  await client.query('BEGIN');await client.query('SELECT user_id FROM cpanel_user_auth WHERE user_id=$1 FOR UPDATE',[target.id]);
  await client.query("UPDATE cpanel_user_permissions SET value='true' WHERE user_id=$1 AND key='superuser'",[target.id]);
  const protectedSave=assert.rejects(service.save(root,target.id,body()),{code:'protected'});
  await client.query('COMMIT');await protectedSave;
 }finally{await client.query('ROLLBACK');client.release();}
 await grant(target.id,'superuser',false);
 await Promise.all([service.save(root,target.id,body(['users.view'])),service.save(root,target.id,body(['permissions.view','permissions.update']))]);
 const rows=(await db.query('SELECT key FROM cpanel_user_permissions WHERE user_id=$1 AND key=ANY($2::text[]) ORDER BY key',[target.id,booleanPermissionKeys])).rows.map(row=>row.key);
 assert.ok(JSON.stringify(rows)===JSON.stringify(['users.view'])||JSON.stringify(rows)===JSON.stringify(['permissions.update','permissions.view']));
});

test('universal permission service strictness for every Users/Permissions boolean and Super User',async()=>{
 for(const key of [...booleanPermissionKeys,'superuser'])for(const value of [undefined,false,null,'true','false',1,0,{},[],true]){
  await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await grant(normal.id,key,value);
  const context=new PermissionContext(normal.id,new AuthRepository(db));
  assert.equal(await context.hasPermission(key),value===true,`${key} ${JSON.stringify(value)}`);
  if(key==='superuser')for(const action of booleanPermissionKeys)assert.equal(await context.hasPermission(action),value===true);
 }
});
