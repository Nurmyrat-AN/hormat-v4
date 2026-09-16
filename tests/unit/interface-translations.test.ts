import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {TranslationRepository,type TranslationActor} from '../../src/interface-translations/repository.js';
import {TranslationService} from '../../src/interface-translations/service.js';
import {LocalizationService} from '../../src/localization/service.js';
import {readLocalizationData} from '../../src/localization/repository.js';
const schema='translations_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),cache=new LocalizationService(()=>readLocalizationData(db)),repo=new TranslationRepository(db),service=new TranslationService(repo,async()=>{cache.invalidate();await cache.ensureFresh();});
let actor:TranslationActor,normal:TranslationActor;
async function createActor(){const u=await bootstrapSuperuser({name:'Translation test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);return {id:u.id,sessionHash:(await new SessionRepository(db).create(u.id)).session.token_hash};}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);actor=await createActor();normal=await createActor();await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query("INSERT INTO languages(code,display_name,is_active) VALUES('xx','New language',true),('yy','Inactive language',false)");await db.query("INSERT INTO interface_translations VALUES('tm','test.explicit','Esasy'),('en','test.explicit','Needle value'),('yy','test.explicit','Preserve'),('tm','test.empty',NULL)");await cache.load();});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('search key/any value, derived prefix, explicit completion and dynamic missing-language filters',async()=>{
 assert.equal((await service.list(actor,{query:'NEEDLE'})).rows[0].key,'test.explicit');assert.equal((await service.list(actor,{query:'preserve'})).rows[0].key,'test.explicit');
 const data=await service.list(actor,{prefix:'test'});assert.equal(data.total,2);assert.ok(data.groups.includes('test'));assert.ok(data.languages.some(l=>l.code==='xx'));assert.ok(!data.languages.some(l=>l.code==='yy'));
 assert.equal((await service.list(actor,{prefix:'test',completion:'missing',language:'ru'})).total,2);
 assert.equal(cache.translate('ru','test.explicit'),'Esasy');assert.ok(data.rows.find(r=>r.key==='test.explicit')!.missing.includes('ru'));
 assert.equal((await service.list(actor,{prefix:'test',completion:'complete'})).total,0);
 await service.save(actor,'test.explicit',{values:{ru:'Явно',xx:'Explicit'}});assert.equal((await service.list(actor,{prefix:'test',completion:'complete'})).total,1);
 await assert.rejects(service.list(actor,{completion:'missing',language:'yy'}),{code:'TRANSLATION_INVALID'});
});
test('save real values, clear to NULL, retain key, preserve omitted/inactive data and refresh cached fallback',async()=>{
 await service.save(actor,'test.explicit',{values:{ru:'Changed'}});assert.equal(cache.translate('ru','test.explicit'),'Changed');
 await service.save(actor,'test.explicit',{values:{ru:' \t ',tm:null}});assert.equal(cache.translate('ru','test.explicit'),'Explicit');
 assert.equal((await db.query("SELECT translation_value FROM interface_translations WHERE language_code='yy' AND translation_key='test.explicit'")).rows[0].translation_value,'Preserve');
 await service.save(actor,'test.empty',{values:{tm:''}});assert.equal((await service.detail(actor,'test.empty')).key,'test.empty');assert.equal(cache.translate('tm','test.empty'),'test.empty');
 await service.save(actor,'test.empty',{values:{tm:'Restored'}});assert.equal(cache.translate('tm','test.empty'),'Restored');
});
test('existing immutable key, active language and string/null allowlists reject malicious payloads',async()=>{
 await assert.rejects(service.save(actor,'test.unknown',{values:{en:'Created'}}),{code:'TRANSLATION_NOT_FOUND'});
 for(const input of [{key:'another.key',values:{en:'No'}},{values:{yy:'No'}},{values:{unknown:'No'}},{values:{en:42}},{values:{en:{value:'No'}}},{values:[]},{values:{}},{values:{en:'a\0b'}}])await assert.rejects(service.save(actor,'test.explicit',input),{code:'TRANSLATION_INVALID'});
 assert.equal((await db.query("SELECT count(*)::int n FROM interface_translations WHERE translation_key='test.unknown'")).rows[0].n,0);
});
test('independent exact boolean view/update permissions, no implicit grants, revoked sessions',async()=>{
 const grant=async(key:string,value:unknown)=>{await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query('INSERT INTO cpanel_user_permissions VALUES($1,$2,$3,now(),now())',[normal.id,key,JSON.stringify(value)]);};
 for(const value of [false,'true',1,null]){await grant('interface_translations.update',value);await assert.rejects(service.save(normal,'test.empty',{values:{en:'No'}}),{code:'TRANSLATION_FORBIDDEN'});}
 await grant('interface_translations.view',true);await service.detail(normal,'test.empty');await assert.rejects(service.save(normal,'test.empty',{values:{en:'No'}}),{code:'TRANSLATION_FORBIDDEN'});
 await grant('interface_translations.update',true);await service.save(normal,'test.empty',{values:{en:'Allowed'}});await assert.rejects(service.list(normal,{}),{code:'TRANSLATION_FORBIDDEN'});
 await db.query('DELETE FROM cpanel_sessions WHERE token_hash=$1',[normal.sessionHash]);await assert.rejects(service.save(normal,'test.empty',{values:{en:'No'}}),{code:'TRANSLATION_FORBIDDEN'});
});
test('multi-language save rollback is atomic and committed cache failures remain distinct',async()=>{
 await db.query(`CREATE FUNCTION reject_translation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.translation_value='FAIL' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END; $$; CREATE TRIGGER reject_translation BEFORE INSERT OR UPDATE ON interface_translations FOR EACH ROW EXECUTE FUNCTION reject_translation();`);
 const before=(await db.query("SELECT * FROM interface_translations WHERE translation_key='test.empty' ORDER BY language_code")).rows;
 await assert.rejects(service.save(actor,'test.empty',{values:{tm:'Should rollback',en:'FAIL'}}),{code:'TRANSLATION_SAVE_FAILED'});
 assert.deepEqual((await db.query("SELECT * FROM interface_translations WHERE translation_key='test.empty' ORDER BY language_code")).rows,before);
 const result=await new TranslationService(repo,async()=>{throw Error('offline');}).save(actor,'test.empty',{values:{tm:'Committed'}});assert.equal(result.cacheRefreshed,false);assert.equal((await service.detail(actor,'test.empty')).values.tm,'Committed');
});
