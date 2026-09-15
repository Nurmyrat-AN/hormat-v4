import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, rm, symlink, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { pool } from '../../src/database/pool.js';
import { migrate } from '../../src/database/migrate.js';
import { bootstrapSuperuser } from '../../src/cpanel/auth/bootstrap.js';
import { SessionRepository } from '../../src/cpanel/auth/sessions.js';
import { ProfileRepository } from '../../src/cpanel/profile/repository.js';
import { updateProfile, avatarDestination } from '../../src/cpanel/profile/service.js';
import { MediaStore } from '../../src/media/store.js';
import { describeFile } from '../../src/media/metadata.js';
const schema = `profile_test_${randomUUID().replaceAll('-', '')}`;
const db = new pg.Pool({ ...config.database, options: `-c search_path=${schema}` });
const repository = new ProfileRepository(db), sessions = new SessionRepository(db);
let root: string, media: MediaStore;
before(async () => { await pool.query(`CREATE SCHEMA ${schema}`); await migrate(db); root = await mkdtemp(path.join(os.tmpdir(), 'hormat-profile-')); media = new MediaStore(root,24); await media.initialize(); });
after(async () => { await rm(root,{recursive:true,force:true}); await db.end(); await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });
async function user() { const u = await bootstrapSuperuser({ name:'Profile test',email:`${randomUUID()}@example.invalid`,password:'Profile test password 123'},db); return {...u, session: (await sessions.create(u.id)).session}; }
const snapshot = async (id: string) => (await db.query('SELECT to_jsonb(u) profile,to_jsonb(a) auth,(SELECT jsonb_agg(p) FROM cpanel_user_permissions p WHERE p.user_id=u.id) permissions FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1',[id])).rows[0];
async function upload(id: string) { const stage = await media.staging(); await writeFile(stage.file,'Original bytes'); return media.publish(stage,id,'original.dat',await describeFile(stage.file)); }
const file = (url:string) => path.join(root,url.slice('/media/'.length));

test('self profile fields: normalization, validation, protected fields and invalidated sessions', async () => {
 const u=await user(), other=await user(); const before=await snapshot(u.id), untouched=await snapshot(other.id);
 for (const [input,result] of [[{name:'  ',phone:''},'invalidName'],[{name:'a'.repeat(201),phone:''},'invalidName'],[{name:'ok',phone:'x'.repeat(51)},'invalidPhone'],[{name:'ok',phone:[]},'invalidPhone'],[{name:'ok\u0000',phone:''},'invalidName']] as const) {
  assert.equal(await updateProfile(u.id,u.session.token_hash,input,repository,media),result); assert.deepEqual(await snapshot(u.id),before);
 }
 for (const field of ['id','userId','targetUser','user_id','email','job','password','password_hash','permissions','superuser','session','avatar_url','avatarUrl','filesystemPath','destination','filename']) {
  assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'changed',phone:'', [field]:other.id},repository,media),'invalidRequest');
 }
 assert.deepEqual(await snapshot(u.id),before); assert.deepEqual(await snapshot(other.id),untouched);
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'  Ännä O’Neil  ',phone:'  +993 (61) 12-34  '},repository,media),'success');
 const saved=await snapshot(u.id); assert.equal(saved.profile.name,'Ännä O’Neil'); assert.equal(saved.profile.phone,'+993 (61) 12-34'); assert.equal(saved.profile.job,before.profile.job); assert.deepEqual(saved.auth,before.auth); assert.deepEqual(saved.permissions,before.permissions);
 await db.query('DELETE FROM cpanel_sessions WHERE token_hash=$1',[u.session.token_hash]);
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'Revoked',phone:''},repository,media),'failure'); assert.deepEqual(await snapshot(u.id),saved);
});

test('avatar lifecycle, no-new-avatar, replacement, consumed/foreign/expired/missing/traversal tokens', async () => {
 const u=await user(), other=await user(); const one=await upload(u.id);
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'One',phone:'',avatarCacheToken:one.cacheToken},repository,media),'success');
 const first=(await snapshot(u.id)).profile.avatar_url;
 assert.match(first,/^\/media\/users\/avatars\/[a-f0-9-]+\.bin$/); assert.ok(!first.includes('/cache/')&&!first.includes(root)&&!first.includes('..')); assert.equal(await readFile(file(first),'utf8'),'Original bytes'); await assert.rejects(media.preview(one.cacheToken,'bin'));
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'No avatar change',phone:'123',avatarCacheToken:null},repository,media),'success'); assert.equal((await snapshot(u.id)).profile.avatar_url,first); assert.equal(await readFile(file(first),'utf8'),'Original bytes');
 const foreign=await upload(other.id), expired=await upload(u.id), missing=await upload(u.id);
 const recordPath=path.join(root,'cache',expired.cacheToken,'record.json'); const record=JSON.parse(await readFile(recordPath,'utf8')); record.expiresAt=0; await writeFile(recordPath,JSON.stringify(record));
 await rm(path.join(root,'cache',missing.cacheToken,'asset.bin'));
 const before=await snapshot(u.id);
 for(const token of ['forged',randomUUID(),'../outside',one.cacheToken,foreign.cacheToken,expired.cacheToken,missing.cacheToken]) {
  assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'Invalid avatar',phone:'',avatarCacheToken:token},repository,media),'avatarFailed'); assert.deepEqual(await snapshot(u.id),before);
 }
 const two=await upload(u.id); assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'Two',phone:'',avatarCacheToken:two.cacheToken},repository,media),'success');
 const second=(await snapshot(u.id)).profile.avatar_url; assert.notEqual(first,second); await assert.rejects(access(file(first))); assert.equal(await readFile(file(second),'utf8'),'Original bytes');
 await db.query("UPDATE cpanel_users SET avatar_url='https://example.invalid/external.png' WHERE id=$1",[u.id]);
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'External replacement',phone:'',avatarCacheToken:(await upload(u.id)).cacheToken},repository,media),'success');
});

test('database UPDATE failure compensates new final file, preserving old DB and bytes', async () => {
 const u=await user(); const old=await upload(u.id);
 await updateProfile(u.id,u.session.token_hash,{name:'Old',phone:'',avatarCacheToken:old.cacheToken},repository,media);
 const before=await snapshot(u.id), finalDir=path.join(root,avatarDestination), files=await readdir(finalDir); const fresh=await upload(u.id);
 await db.query("CREATE FUNCTION fail_profile_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled failure'; END $$; CREATE TRIGGER fail_profile BEFORE UPDATE ON cpanel_users FOR EACH ROW EXECUTE FUNCTION fail_profile_save()");
 try { assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'New',phone:'',avatarCacheToken:fresh.cacheToken},repository,media),'failure'); }
 finally { await db.query('DROP TRIGGER fail_profile ON cpanel_users'); }
 assert.deepEqual(await snapshot(u.id),before); assert.deepEqual(await readdir(finalDir),files); assert.equal(await readFile(file(before.profile.avatar_url),'utf8'),'Original bytes'); await assert.rejects(media.preview(fresh.cacheToken,'bin'));
});

test('managed deletion refuses external/legacy/traversal/symlink paths and concurrent saves remain consistent', async () => {
 const u=await user(); const first=await upload(u.id), second=await upload(u.id);
 assert.deepEqual(await Promise.all([first,second].map(m=>updateProfile(u.id,u.session.token_hash,{name:'Concurrent',phone:'',avatarCacheToken:m.cacheToken},repository,media))),['success','success']);
 const url=(await snapshot(u.id)).profile.avatar_url; await access(file(url));
 for(const unsafe of ['https://example.invalid/a','/public/legacy.jpg','/media/users/avatars/../../outside',url+'?x',url.replace('/avatars/','/elsewhere/')]) assert.equal(await media.deleteManagedFile(unsafe,avatarDestination),false);
 const target=path.join(root,'sentinel'); await writeFile(target,'untouched'); const link=`${randomUUID()}.bin`; await symlink(target,path.join(root,avatarDestination,link));
 assert.equal(await media.deleteManagedFile(`/media/${avatarDestination}/${link}`,avatarDestination),false); assert.equal(await readFile(target,'utf8'),'untouched');
 assert.equal(await media.deleteManagedFile(url,avatarDestination),true); assert.equal(await media.deleteManagedFile(url,avatarDestination),false);
});

test('lost COMMIT acknowledgement preserves potentially referenced media for reconciliation', async () => {
 const u=await user(), fresh=await upload(u.id);
 const uncertainDatabase = new Proxy(db, { get(target, prop) {
  if(prop !== 'connect') { const value=Reflect.get(target,prop); return typeof value==='function'?value.bind(target):value; }
  return async()=>{
   const client=await db.connect();
   return new Proxy(client,{get(target,prop){
    if(prop==='query') return async(...args:unknown[])=>{ const result=await (client.query as Function).apply(client,args); if(args[0]==='COMMIT') throw new Error('Simulated lost acknowledgement'); return result; };
    const value=Reflect.get(target,prop); return typeof value==='function'?value.bind(target):value;
   }});
  };
 }});
 assert.equal(await updateProfile(u.id,u.session.token_hash,{name:'Committed',phone:'',avatarCacheToken:fresh.cacheToken},new ProfileRepository(uncertainDatabase),media),'failure');
 const saved=await snapshot(u.id); assert.equal(saved.profile.name,'Committed'); assert.equal(await readFile(file(saved.profile.avatar_url),'utf8'),'Original bytes');
});
