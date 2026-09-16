import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {pool} from '../../src/database/pool.js';
import {config} from '../../src/config/env.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {SettingsRepository,defaultCurrencyKey} from '../../src/settings/repository.js';
import {SettingsService} from '../../src/settings/typed.js';
import {MarketplaceDefaultsService} from '../../src/settings/defaults.js';
import {CurrenciesService} from '../../src/currencies/service.js';
import {CurrenciesRepository} from '../../src/currencies/repository.js';
import {LocalizationService} from '../../src/localization/service.js';
import {readLocalizationData} from '../../src/localization/repository.js';
import type {LanguageActor} from '../../src/languages/repository.js';
const schema='settings_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),repository=new SettingsRepository(db);
const cache=new LocalizationService(()=>readLocalizationData(db));
const service=new MarketplaceDefaultsService(repository,async()=>{cache.invalidate();await cache.ensureFresh();}),currencies=new CurrenciesService(new CurrenciesRepository(db));
let root:LanguageActor,normal:LanguageActor,c1:string,c2:string,hidden:string,p1:string,p2:string,d1:string,d2:string;
async function actor(){const u=await bootstrapSuperuser({name:'Settings test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);return {id:u.id,sessionHash:(await new SessionRepository(db).create(u.id)).session.token_hash};}
async function current(){return (await service.read(root)).defaults;}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor();normal=await actor();await cache.load();
 for(const [name,visible] of [['One',true],['Two',true],['Hidden',false]]as const){const row=(await currencies.mutate(root,'create',undefined,{name,code:name,symbol:'$',rate:'1'})).row;await currencies.mutate(root,'basic',row.id,{is_visible:visible});if(name==='One')c1=row.id;else if(name==='Two')c2=row.id;else hidden=row.id;}
 for(const [kind,s] of [['payment',service.payment],['delivery',service.delivery]]as const){const ids=[];for(const name of ['A','B']){const row=(await s.mutate(root,'create',undefined,{name})).row;await s.mutate(root,'basic',row.id,{is_visible:true});ids.push(row.id);}if(kind==='payment')[p1,p2]=ids;else[d1,d2]=ids;}
});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('typed registry service validates all five types, exact numeric transport and schema',async()=>{
 const typed=new SettingsService(repository,{text:'string',count:'integer',amount:'decimal',flag:'boolean',data:'json'});
 await typed.set('text','hello',root.id);await typed.set('count','9007199254740993',root.id);await typed.set('amount','12.3400',root.id);await typed.set('flag',false,root.id);await typed.set('data',{a:[1,true,null]},root.id);
 assert.equal(await typed.getString('text'),'hello');assert.equal(await typed.getInteger('count'),9007199254740993n);assert.equal(await typed.getDecimal('amount'),'12.34');assert.equal(await typed.getBoolean('flag'),false);assert.deepEqual(await typed.getJson('data'),{a:[1,true,null]});
 for(const [key,value] of [['count','hello'],['count',1.1],['count',Number.MAX_SAFE_INTEGER+1],['amount','NaN'],['flag','true'],['text',false],['data',{a:undefined}],['unknown',true]])await assert.rejects(typed.set(key as string,value,root.id),{code:'SETTINGS_INVALID'});
 await assert.rejects(typed.getString('count'),{code:'SETTINGS_INVALID'});
 await assert.rejects(db.query("INSERT INTO settings(key,type,value) VALUES('bad','integer','\"hello\"')"),{code:'23514'});
 assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='settings' ORDER BY ordinal_position",[schema])).rows.map(r=>r.column_name),['key','value','type','updated_by','created_at','updated_at']);
 await db.query("DELETE FROM settings WHERE key<>$1",[defaultCurrencyKey]);
});
test('defaults load from authoritative domains; unconfigured currency is null and invisible options excluded',async()=>{
 const data=await service.read(root);assert.deepEqual(data.defaults,{orderStatus:null,language:'tm',currency:null,payment:null,delivery:null});assert.equal(await service.settings.get(defaultCurrencyKey),null);assert.deepEqual(data.options.currencies.map(c=>c.id),[c1,c2]);
});
test('atomic save uses existing Language/default logic, persists currency and refreshes language cache',async()=>{
 const result=await service.save(root,{orderStatus:null,language:'ru',currency:c1,payment:p1,delivery:d1});assert.equal(result.cacheRefreshed,true);assert.equal(cache.defaultLanguage,'ru');assert.deepEqual(await current(),{orderStatus:null,language:'ru',currency:c1,payment:p1,delivery:d1});
 assert.deepEqual((await db.query('SELECT key,type,value,updated_by::text FROM settings')).rows,[{key:defaultCurrencyKey,type:'integer',value:c1,updated_by:root.id}]);
 await service.save(root,{orderStatus:null,language:'en',currency:c2,payment:p2,delivery:d2});assert.deepEqual(await current(),{orderStatus:null,language:'en',currency:c2,payment:p2,delivery:d2});
 await service.save(root,{orderStatus:null,language:'en',currency:c2,payment:null,delivery:null});assert.equal((await current()).payment,null);assert.equal((await current()).delivery,null);
});
test('invalid selections and incomplete Language roll back all domains and do not refresh cache',async()=>{
 const before=await current();
 for(const currency of [hidden,'9223372036854775807',null])await assert.rejects(service.save(root,{...before,language:'tm',currency,payment:p1,delivery:d1}),{code:'SETTINGS_INVALID_CURRENCY'});
 await db.query("INSERT INTO languages(code,display_name,is_active) VALUES('xx','Incomplete',true)");await assert.rejects(service.save(root,{...before,language:'xx'}),{code:'SETTINGS_LANGUAGE_INCOMPLETE'});
 await service.delivery.mutate(root,'basic',d1,{is_visible:false});await assert.rejects(service.save(root,{orderStatus:null,language:'tm',currency:c1,payment:p1,delivery:d1}),{code:'SETTINGS_INVALID'});
 assert.deepEqual(await current(),before);assert.equal(cache.defaultLanguage,'en');await service.delivery.mutate(root,'basic',d1,{is_visible:true});
 await db.query("CREATE FUNCTION reject_setting() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'test';END;$$; CREATE TRIGGER reject_setting BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION reject_setting()");
 await assert.rejects(service.save(root,{orderStatus:null,language:'tm',currency:c1,payment:p1,delivery:d1}),{code:'SETTINGS_FAILED'});assert.deepEqual(await current(),before);await db.query('DROP TRIGGER reject_setting ON settings');
});
test('current Default Currency cannot be hidden; replacing it releases former currency; no stale settings cache',async()=>{
 await assert.rejects(currencies.mutate(root,'basic',c2,{is_visible:false}),{code:'CURRENCY_DEFAULT_PROTECTED'});assert.equal((await currencies.details(root,c2)).row.visible,true);
 await service.save(root,{...await current(),currency:c1});await currencies.mutate(root,'basic',c2,{is_visible:false});assert.equal(await service.settings.getInteger(defaultCurrencyKey),BigInt(c1));await currencies.mutate(root,'basic',c2,{is_visible:true});
});
test('settings permissions are independent, exact boolean; no underlying domain permissions needed',async()=>{
 const grant=async(key:string,value:unknown)=>{await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);};
 for(const value of [false,'true',1,null]){await grant('settings.update',value);await assert.rejects(service.save(normal,await current()),{code:'SETTINGS_FORBIDDEN'});}
 await grant('settings.view',true);await service.read(normal);await assert.rejects(service.save(normal,await current()),{code:'SETTINGS_FORBIDDEN'});
 await grant('settings.update',true);await assert.rejects(service.read(normal),{code:'LANGUAGE_FORBIDDEN'});await service.save(normal,{orderStatus:null,language:'tm',currency:c2,payment:p1,delivery:d1});assert.equal((await current()).currency,c2);
 for(const body of [{...await current(),updated_by:root.id},{orderStatus:null,language:'tm'},{...await current(),currency:true}])await assert.rejects(service.save(normal,body),{code:'SETTINGS_INVALID'});
});
test('concurrent Currency hiding and Defaults save cannot leave a hidden default',async()=>{
 await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'currencies.frontend.visibility','true') ON CONFLICT(user_id,key) DO UPDATE SET value='true'",[normal.id]);
 const results=await Promise.allSettled([service.save(root,{...await current(),currency:c1}),currencies.mutate(normal,'basic',c1,{is_visible:false})]);assert.ok(results.some(r=>r.status==='fulfilled'));
 const selected=String(await service.settings.getInteger(defaultCurrencyKey));assert.equal((await currencies.details(root,selected)).row.visible,true);
});

test('Settings Order Status extension: current/visible translated options, switch/clear, isolated defaults and rollback',async()=>{
 const first=(await service.orderStatus.mutate(root,'create',undefined,{name:'Base A'})).row.id;
 const second=(await service.orderStatus.mutate(root,'create',undefined,{name:'Base B'})).row.id;
 const hiddenStatus=(await service.orderStatus.mutate(root,'create',undefined,{name:'Hidden'})).row.id;
 await service.orderStatus.mutate(root,'basic',first,{is_default:true});await service.orderStatus.mutate(root,'basic',second,{is_visible:true});
 await service.orderStatus.mutate(root,'translations',first,{field:'name',translations:{ru:'Перевод A'}});
 const initial=await service.read(root,'ru');assert.equal(initial.defaults.orderStatus,first);assert.deepEqual(initial.options.orderStatus.map(s=>s.id),[first,second]);assert.equal(initial.options.orderStatus[0].name,'Перевод A');assert.equal(initial.options.orderStatus[1].name,'Base B');assert.equal((await service.read(root,'en')).options.orderStatus[0].name,'Base A');
 await service.save(root,{...initial.defaults,orderStatus:second});assert.equal((await service.orderStatus.detail(root,first)).row.basic.default,false);assert.equal((await service.orderStatus.detail(root,second)).row.basic.default,true);assert.equal((await service.orderStatus.detail(root,second)).row.basic.visible,true);
 assert.deepEqual(await current(),{...initial.defaults,orderStatus:second});
 const committed=await current();await assert.rejects(service.save(root,{...committed,language:'ru',currency:c1,payment:p1,delivery:d1,orderStatus:hiddenStatus}),{code:'SETTINGS_INVALID'});assert.deepEqual(await current(),committed);
 await service.save(root,{...committed,orderStatus:null});assert.equal((await current()).orderStatus,null);assert.equal((await db.query('SELECT * FROM order_statuses WHERE is_default')).rowCount,0);
 assert.ok((await db.query('SELECT key FROM settings')).rows.every(r=>r.key===defaultCurrencyKey));
});
