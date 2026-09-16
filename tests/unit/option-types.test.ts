import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {pool} from '../../src/database/pool.js';
import {config} from '../../src/config/env.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {OptionTypesRepository,type TypeActor} from '../../src/option-types/repository.js';
import {OptionTypesService} from '../../src/option-types/service.js';
import {MediaBrowser} from '../../src/cpanel/media/browser.js';
const schema='option_types_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64');
let root:TypeActor,other:TypeActor,normal:TypeActor,mediaRoot:string;const services={}as Record<'payment'|'delivery',OptionTypesService>;
async function actor(){const u=await bootstrapSuperuser({name:'Type test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);return {id:u.id,sessionHash:(await new SessionRepository(db).create(u.id)).session.token_hash};}
async function grant(key:string,value:unknown=true){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor();other=await actor();normal=await actor();await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);mediaRoot=await mkdtemp(path.join(tmpdir(),'hormat-types-'));await writeFile(path.join(mediaRoot,'icon.png'),pixel);await writeFile(path.join(mediaRoot,'fake.png'),'not image');for(const kind of ['payment','delivery']as const)services[kind]=new OptionTypesService(new OptionTypesRepository(kind,db),new MediaBrowser(mediaRoot));});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();if(mediaRoot)await rm(mediaRoot,{recursive:true,force:true});});
for(const kind of ['payment','delivery']as const){const table=kind+'_types',tr=kind+'_type_translations',fk=kind+'_type_id';let first:string,second:string;
 test(kind+': create hidden/nondefault, real base metadata, literal search/filter/sort',async()=>{
  const service=services[kind];first=(await service.mutate(root,'create',undefined,{name:' First '+kind+' ',description:'Needle % description',sort_order:20})).row.id;second=(await service.mutate(root,'create',undefined,{name:'Second '+kind,sort_order:10})).row.id;
  const row=(await service.detail(root,first)).row;assert.equal(row.basic.name,'First '+kind);assert.equal(row.basic.default,false);assert.equal(row.basic.visible,false);assert.equal(row.basic.icon,null);assert.deepEqual(row.translations,{name:{},description:{}});
  assert.equal((await service.list(root,{query:'%'})).rows[0].id,first);assert.deepEqual((await service.list(root,{})).rows.map(r=>r.id),[second,first]);assert.equal((await service.list(root,{visibility:'visible'})).total,0);
  await service.mutate(root,'basic',first,{name:'Renamed',description:'Saved description',sort_order:-2,is_visible:true});assert.equal((await service.list(root,{query:'saved',visibility:'visible'})).rows[0].id,first);
 });
 test(kind+': independent field translations, base fallback, inactive preservation, registry validation',async()=>{
  const s=services[kind];await s.mutate(root,'translations',first,{field:'name',translations:{en:'Translated name'}});await s.mutate(root,'translations',first,{field:'description',translations:{en:'Translated description',ru:'Описание'}});
  await s.mutate(root,'translations',first,{field:'name',translations:{en:' '}});let row=(await s.detail(root,first)).row;assert.equal(row.translations.name.en,undefined);assert.equal(row.basic.name,'Renamed');assert.equal(row.translations.description.en,'<p>Translated description</p>');
  await db.query("INSERT INTO languages(code,display_name) VALUES('xx','Inactive') ON CONFLICT DO NOTHING");await db.query(`INSERT INTO ${tr}(${fk},language_code,name) VALUES($1,'xx','Preserved')`,[first]);await s.mutate(root,'translations',first,{field:'description',translations:{ru:null}});assert.equal((await db.query(`SELECT name FROM ${tr} WHERE ${fk}=$1 AND language_code='xx'`,[first])).rows[0].name,'Preserved');
  await assert.rejects(s.mutate(root,'translations',first,{field:'name',translations:{unknown:'No'}}),{code:'TYPE_INVALID'});await assert.rejects(s.mutate(root,'translations',first,{field:'name',translations:{xx:'No'}}),{code:'TYPE_INVALID'});
 });
 test(kind+': Media reference validation, missing-file fallback and clear without deletion',async()=>{
  const s=services[kind];await s.mutate(root,'basic',first,{icon_media_reference:'icon.png'});assert.equal((await s.detail(root,first)).row.basic.icon?.path,'icon.png');
  for(const ref of ['../escape','/etc/passwd','file:///etc/passwd','%2e%2e/a','cache/icon.png','fake.png'])await assert.rejects(s.mutate(root,'basic',first,{icon_media_reference:ref}),{code:'TYPE_INVALID_MEDIA'});
  await db.query(`UPDATE ${table} SET icon_media_reference='missing.png' WHERE id=$1`,[first]);assert.equal((await s.detail(root,first)).row.basic.icon?.url,null);assert.equal((await db.query(`SELECT icon_media_reference FROM ${table} WHERE id=$1`,[first])).rows[0].icon_media_reference,'missing.png');
  await s.mutate(root,'basic',first,{icon_media_reference:null});assert.deepEqual(await readFile(path.join(mediaRoot,'icon.png')),pixel);
 });
 test(kind+': optional default, atomic switch, visible invariant, sorting independence and concurrent writers',async()=>{
  const s=services[kind];await s.mutate(root,'basic',first,{is_default:true});await s.mutate(root,'basic',second,{is_default:true});assert.equal((await s.detail(root,first)).row.basic.default,false);assert.equal((await s.detail(root,second)).row.basic.visible,true);assert.equal((await s.list(root,{})).rows[0].id,first);
  await assert.rejects(s.mutate(root,'basic',second,{is_visible:false}),{code:'TYPE_DEFAULT_VISIBLE'});await assert.rejects(db.query(`UPDATE ${table} SET is_visible=false WHERE id=$1`,[second]),{code:'23514'});await assert.rejects(db.query(`UPDATE ${table} SET is_default=true WHERE id=$1`,[first]),{code:'23505'});
  await Promise.all([s.mutate(root,'basic',first,{is_default:true}),s.mutate(other,'basic',second,{is_default:true})]);assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE is_default`)).rows[0].n,1);
  for(const id of [first,second])await s.mutate(root,'basic',id,{is_default:false});assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE is_default`)).rows[0].n,0);
  await s.mutate(root,'basic',second,{is_visible:false});
 });
 test(kind+': independent exact permissions including Default auto-visibility and Media boundaries',async()=>{
  const s=services[kind];for(const action of ['view','create','update','visibility'])for(const value of [false,'true',1,null]){await grant(table+'.'+action,value);const call=action==='view'?s.list(normal,{}):s.mutate(normal,action==='create'?'create':'basic',action==='create'?undefined:first,action==='visibility'?{is_visible:true}:{name:'No'});await assert.rejects(call,{code:'TYPE_FORBIDDEN'});}
  await grant(table+'.view');await s.detail(normal,first);await assert.rejects(s.mutate(normal,'basic',first,{name:'No'}),{code:'TYPE_FORBIDDEN'});
  await grant(table+'.create');const created=await s.mutate(normal,'create',undefined,{name:'Allowed create'});await assert.rejects(s.detail(normal,created.row.id),{code:'TYPE_FORBIDDEN'});
  await grant(table+'.update');await s.mutate(normal,'basic',second,{is_default:true});await assert.rejects(s.mutate(normal,'basic',first,{is_visible:true}),{code:'TYPE_FORBIDDEN'});await assert.rejects(s.mutate(normal,'basic',first,{icon_media_reference:'icon.png'}),{code:'TYPE_FORBIDDEN'});await s.mutate(normal,'basic',second,{is_default:false});
  await grant(table+'.visibility');await s.mutate(normal,'basic',first,{is_visible:false});await assert.rejects(s.mutate(normal,'basic',first,{is_default:true}),{code:'TYPE_FORBIDDEN'});await assert.rejects(s.mutate(normal,'translations',first,{field:'name',translations:{en:'No'}}),{code:'TYPE_FORBIDDEN'});
 });
 test(kind+': rejects server-owned/unexpected fields and preserves failed transactions',async()=>{
  const s=services[kind];for(const key of ['id','created_by','updated_at','currency','gallery'])await assert.rejects(s.mutate(root,'basic',first,{[key]:'No'}),{code:'TYPE_INVALID'});
  for(const body of [{name:''},{sort_order:1.5},{is_default:'true'}])await assert.rejects(s.mutate(root,'basic',first,body),{code:'TYPE_INVALID'});
  await assert.rejects(s.mutate(root,'create',undefined,{name:'No',is_default:true}),{code:'TYPE_INVALID'});
  await s.mutate(root,'basic',first,{is_default:true});await db.query(`CREATE FUNCTION ${kind}_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='FAIL' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END; $$; CREATE TRIGGER ${kind}_fail BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${kind}_fail();`);
  await assert.rejects(s.mutate(root,'basic',second,{name:'FAIL',is_default:true}),{code:'TYPE_SAVE_FAILED'});assert.equal((await s.detail(root,first)).row.basic.default,true);assert.equal((await s.detail(root,second)).row.basic.default,false);
 });
}
test('Payment and Delivery defaults are independent; exact paid NUMERIC and free normalization, no currency column',async()=>{
 for(const kind of ['payment','delivery']as const)assert.equal((await db.query(`SELECT count(*)::int n FROM ${kind}_types WHERE is_default`)).rows[0].n,1);
 const delivery=services.delivery,row=(await delivery.mutate(root,'create',undefined,{name:'Decimal',is_free:false,price:'12345678901234567890.123456789'})).row;assert.equal(row.basic.price,'12345678901234567890.123456789');
 await delivery.mutate(root,'basic',row.id,{is_free:true,price:'15.25'});assert.equal((await delivery.detail(root,row.id)).row.basic.price,'0');
 for(const price of ['-1','NaN','Infinity',1.5])await assert.rejects(delivery.mutate(root,'basic',row.id,{is_free:false,price}),{code:'TYPE_INVALID'});
 assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=$1 AND table_name IN ('payment_types','delivery_types') AND column_name LIKE '%currency%'",[schema])).rows[0].n,0);
 await assert.rejects(services.payment.mutate(root,'basic','1',{price:'12'}),{code:'TYPE_INVALID'});
});
