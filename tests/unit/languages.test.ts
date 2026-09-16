import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {LanguagesRepository,type LanguageActor} from '../../src/languages/repository.js';
import {LanguagesService} from '../../src/languages/service.js';
import {LocalizationService} from '../../src/localization/service.js';
import {readLocalizationData} from '../../src/localization/repository.js';
const schema='languages_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),cache=new LocalizationService(()=>readLocalizationData(db)),repository=new LanguagesRepository(db),service=new LanguagesService(repository,async()=>{cache.invalidate();await cache.ensureFresh();});
let root:LanguageActor,normal:LanguageActor;
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Language test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
const create=async(code:string)=>(await service.mutate(root,'create',undefined,{code,name:'Language '+code,sort_order:10})).row;
const complete=async(code:string)=>db.query('INSERT INTO interface_translations(language_code,translation_key,translation_value) SELECT $1,t.translation_key,t.translation_value FROM interface_translations t JOIN languages l ON l.code=t.language_code AND l.is_default ON CONFLICT DO NOTHING',[code]);
async function grants(keys:Record<string,unknown>){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);for(const [key,value]of Object.entries(keys))await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);await cache.load();});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('Existing registry preserves tm/ru/en/default/translations; missing updated_at added and new defaults inactive',async()=>{
 assert.deepEqual((await db.query('SELECT code,is_active,is_default FROM languages ORDER BY sort_order')).rows,[{code:'tm',is_active:true,is_default:true},{code:'ru',is_active:true,is_default:false},{code:'en',is_active:true,is_default:false}]);assert.equal(cache.defaultLanguage,'tm');assert.equal(cache.translate('en','frontend.title'),'Frontend');
 const columns=(await db.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='languages'",[schema])).rows;assert.ok(columns.some(r=>r.column_name==='updated_at'&&r.data_type==='timestamp with time zone'));assert.ok(!columns.some(r=>r.column_name==='id'));
 const row=await create('xx-create');assert.equal(row.code,'xx-create');assert.equal(row.is_active,false);assert.equal(row.is_default,false);assert.equal(row.translation_count,0);assert.equal(cache.isActive('xx-create'),false);
 await db.query("INSERT INTO languages(code,display_name) VALUES('xx-db','Direct fixture')");assert.equal((await db.query("SELECT is_active FROM languages WHERE code='xx-db'")).rows[0].is_active,false);
});
test('Unique immutable code, required metadata, integer order and server-owned validation',async()=>{
 await assert.rejects(create('xx-create'),{code:'LANGUAGE_DUPLICATE'});
 for(const code of ['','EN','en_US','../tm'])await assert.rejects(create(code),{code:'LANGUAGE_INVALID_REQUEST'});
 for(const body of [{code:'xx-create',name:''},{code:'xx-create',name:'Valid',is_active:true},{code:'xx-create',name:'Valid',created_at:'now'},{code:'xx-create',name:'Valid',sort_order:1.5}])await assert.rejects(service.mutate(root,'create',undefined,body),{code:'LANGUAGE_INVALID_REQUEST'});
 await assert.rejects(service.mutate(root,'edit','xx-create',{code:'new'}),{code:'LANGUAGE_INVALID_REQUEST'});await assert.rejects(db.query("UPDATE languages SET code='new' WHERE code='xx-create'"),{code:'23514'});
 await service.mutate(root,'edit','xx-create',{name:' Updated ',sort_order:-7});const row=(await service.details(root,'xx-create')).row;assert.equal(row.display_name,'Updated');assert.equal(row.sort_order,-7);assert.equal(row.is_active,false);
});
test('Real name/code literal search, status filters, sort and interface-only counts',async()=>{
 const a=await create('xx-a'),b=await create('xx-b');await service.mutate(root,'edit',a.code,{name:'Needle %',sort_order:3});await service.mutate(root,'edit',b.code,{name:'Needle B',sort_order:1});await service.mutate(root,'status',b.code,{is_active:true});
 assert.deepEqual((await service.list(root,{query:'Needle'})).rows.map(r=>r.code),[b.code,a.code]);assert.deepEqual((await service.list(root,{query:'%',status:'inactive'})).rows.map(r=>r.code),[a.code]);assert.equal((await service.list(root,{query:'XX-B',status:'active'})).rows[0].code,b.code);assert.equal((await service.list(root,{query:"' OR true --"})).rows.length,0);
 assert.equal((await service.details(root,'en')).row.translation_count,753);
});
test('Activation/deactivation refreshes existing cache and inactive cookies fall back; translations preserved',async()=>{
 const key='xx-cache';await create(key);await db.query("INSERT INTO interface_translations VALUES($1,'frontend.title','Custom title')",[key]);await service.mutate(root,'status',key,{is_active:true});assert.equal(cache.forLanguage(key).language,key);assert.equal(cache.translate(key,'frontend.title'),'Custom title');assert.equal(cache.translate(key,'cpanel.title'),cache.translate(cache.defaultLanguage,'cpanel.title'));
 await service.mutate(root,'status',key,{is_active:false});assert.equal(cache.isActive(key),false);assert.equal(cache.forLanguage(key).language,cache.defaultLanguage);assert.equal((await db.query('SELECT * FROM interface_translations WHERE language_code=$1',[key])).rowCount,1);
 await service.mutate(root,'status',key,{is_active:true});assert.equal(cache.translate(key,'frontend.title'),'Custom title');
});
test('Default transition requires complete translations, is atomic, activates target and rejects deactivation',async()=>{
 const key='xx-default';await create(key);await assert.rejects(service.mutate(root,'default',key,{}),{code:'LANGUAGE_TRANSLATIONS_INCOMPLETE'});assert.equal(cache.defaultLanguage,'tm');await complete(key);
 await service.mutate(root,'default',key,{});assert.equal(cache.defaultLanguage,key);assert.equal(cache.isActive(key),true);assert.equal((await db.query('SELECT * FROM languages WHERE is_default')).rowCount,1);
 await assert.rejects(service.mutate(root,'status',key,{is_active:false}),{code:'LANGUAGE_DEFAULT_PROTECTED'});await assert.rejects(service.mutate(root,'edit',key,{is_default:false}),{code:'LANGUAGE_DEFAULT_PROTECTED'});
 await assert.rejects(db.query('UPDATE languages SET is_active=false WHERE code=$1',[key]),{code:'23514'});await assert.rejects(db.query('UPDATE languages SET is_default=false WHERE code=$1',[key]),{code:'23514'});await assert.rejects(db.query("UPDATE languages SET is_default=true WHERE code='en'"),{code:'23505'});
 await service.mutate(root,'default','tm',{});
});
test('Concurrent switches serialize; forced failure rolls back old default, metadata and activation',async()=>{
 await grants({'languages.default':true});await Promise.all([service.mutate(root,'default','en',{}),service.mutate(normal,'default','ru',{})]);assert.equal((await db.query('SELECT * FROM languages WHERE is_default AND is_active')).rowCount,1);
 await service.mutate(root,'default','tm',{});await create('xx-fail');await complete('xx-fail');await db.query(`CREATE FUNCTION fail_language_default() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.code='xx-fail' AND NEW.is_default THEN RAISE EXCEPTION 'forced'; END IF; RETURN NEW; END$$; CREATE TRIGGER fail_default BEFORE UPDATE ON languages FOR EACH ROW EXECUTE FUNCTION fail_language_default()`);
 await assert.rejects(service.mutate(root,'edit','xx-fail',{name:'Must rollback',is_default:true}),{code:'LANGUAGE_SAVE_FAILED'});assert.equal((await service.details(root,'xx-fail')).row.display_name,'Language xx-fail');assert.equal(cache.defaultLanguage,'tm');assert.equal((await service.details(root,'xx-fail')).row.is_active,false);
});
test('Five independent exact permissions, update cannot change flags; current session and Super User',async()=>{
 const key='xx-permission';await create(key);await complete(key);
 const actions:Record<string,()=>Promise<unknown>>={'languages.view':()=>service.list(normal,{}),'languages.create':()=>service.mutate(normal,'create',undefined,{code:'xx-'+randomUUID().slice(0,20),name:'Allowed'}),'languages.update':()=>service.mutate(normal,'edit',key,{name:'Allowed'}),'languages.status':()=>service.mutate(normal,'status',key,{is_active:true}),'languages.default':()=>service.mutate(normal,'default',key,{})};
 for(const [permission,action]of Object.entries(actions)){for(const value of [false,1,'true',null]){await grants({[permission]:value});await assert.rejects(action(),{code:'LANGUAGE_FORBIDDEN'});}await grants({[permission]:true});await action();for(const [other,denied]of Object.entries(actions))if(other!==permission)await assert.rejects(denied(),{code:'LANGUAGE_FORBIDDEN'});}
 await grants({'languages.update':true});await assert.rejects(service.mutate(normal,'edit',key,{is_active:false}),{code:'LANGUAGE_FORBIDDEN'});await assert.rejects(service.mutate(normal,'edit',key,{is_default:true}),{code:'LANGUAGE_FORBIDDEN'});await service.mutate(root,'default','tm',{});
 await db.query('DELETE FROM cpanel_sessions WHERE user_id=$1',[normal.id]);await assert.rejects(service.mutate(normal,'edit',key,{name:'No'}),{code:'LANGUAGE_FORBIDDEN'});
});
test('Post-commit refresh failure reports committed data without fake rollback',async()=>{
 const broken=new LanguagesService(repository,async()=>{throw new Error('offline');});const result=await broken.mutate(root,'edit','xx-create',{name:'Committed'});assert.equal(result.cacheRefreshed,false);assert.equal((await service.details(root,'xx-create')).row.display_name,'Committed');
});
