import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {BrandsRepository,type BrandActor} from '../../src/brands/repository.js';
import {BrandsService} from '../../src/brands/service.js';
import {MediaBrowser} from '../../src/cpanel/media/browser.js';
const schema='brands_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),repo=new BrandsRepository(db);
let root:BrandActor,other:BrandActor,normal:BrandActor,mediaRoot:string,service:BrandsService;
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64');
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Brand test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
const create=async(name='Brand '+randomUUID())=>(await service.mutate(root,'create',undefined,{name})).row.id;
const stored=async(id:string)=>(await db.query('SELECT * FROM brands WHERE id=$1',[id])).rows[0];
const gallery=async(id:string)=>(await db.query('SELECT media_reference,sort_order FROM brand_media WHERE brand_id=$1 ORDER BY sort_order',[id])).rows;
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);other=await actor(true);normal=await actor(false);mediaRoot=await mkdtemp(path.join(tmpdir(),'hormat-brands-'));for(const file of ['a.png','b.png','c.png'])await writeFile(path.join(mediaRoot,file),pixel);await mkdir(path.join(mediaRoot,'cache'));await writeFile(path.join(mediaRoot,'cache','temporary.png'),pixel);await writeFile(path.join(mediaRoot,'fake.png'),'not an image');await symlink('/etc/passwd',path.join(mediaRoot,'escape.png'));service=new BrandsService(repo,new MediaBrowser(mediaRoot));});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();if(mediaRoot)await rm(mediaRoot,{recursive:true,force:true});});
test('schema: exact domain columns, nullable references, hidden default, registry FK and conservative child integrity',async()=>{
 const cols=async(table:string)=>(await db.query('SELECT column_name,data_type,column_default,is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',[schema,table])).rows;
 const brands=await cols('brands');assert.deepEqual(brands.map(c=>c.column_name),['id','name','main_media_reference','is_visible','created_by','updated_by','created_at','updated_at','slug','seo_title','seo_description']);assert.equal(brands.find(c=>c.column_name==='is_visible').column_default,'false');assert.equal(brands.find(c=>c.column_name==='main_media_reference').data_type,'text');assert.equal(brands.find(c=>c.column_name==='main_media_reference').is_nullable,'YES');
 assert.deepEqual((await cols('brand_translations')).map(c=>c.column_name),['brand_id','language_code','name','created_at','updated_at','seo_title','seo_description']);assert.deepEqual((await cols('brand_media')).map(c=>c.column_name),['brand_id','media_reference','sort_order','created_at','updated_at']);
 const id=await create();await db.query("INSERT INTO brand_translations(brand_id,language_code,name) VALUES($1,'ru','Name')",[id]);await assert.rejects(db.query('DELETE FROM brands WHERE id=$1',[id]),{code:'23001'});await assert.rejects(db.query("INSERT INTO brand_translations VALUES($1,'unknown','Name')",[id]),{code:'23503'});await assert.rejects(db.query("INSERT INTO brand_translations(brand_id,language_code,name) VALUES($1,'ru','Duplicate')",[id]),{code:'23505'});
});
test('create trims base, returns real identity, hidden/null defaults, staff attribution and no automatic relations; duplicate names allowed',async()=>{
 const id=await create('  Example  '),row=await stored(id);assert.equal(row.name,'Example');assert.equal(row.is_visible,false);assert.equal(row.main_media_reference,null);assert.equal(row.created_by,root.id);assert.equal(row.updated_by,root.id);assert.deepEqual((await service.details(root,id)).row.translations,{});assert.deepEqual(await gallery(id),[]);assert.notEqual(await create('Example'),id);
 for(const value of ['', '   ', 'a'.repeat(201), 'a\0b', 42])await assert.rejects(service.mutate(root,'create',undefined,{name:value}),{code:'BRAND_INVALID_NAME'});
});
test('translation UPSERT/empty removal, active registry extension, fallback and independent Basic/Gallery persistence',async()=>{
 const id=await create('Base'),before=await stored(id);await service.mutate(root,'translations',id,{translations:{ru:' Пример ',en:'  '}});let result=(await service.details(root,id)).row;assert.equal(result.translations.ru,'Пример');assert.equal(result.translations.en??result.basic.name,'Base');assert.equal((await stored(id)).name,before.name);assert.deepEqual(result.gallery,[]);
 await service.mutate(root,'basic',id,{name:'Base New'});assert.equal((await service.details(root,id)).row.translations.ru,'Пример');await service.mutate(root,'translations',id,{translations:{ru:'   '}});result=(await service.details(root,id)).row;assert.equal(result.translations.ru??result.basic.name,'Base New');assert.equal((await db.query('SELECT count(*)::int n FROM brand_translations WHERE brand_id=$1',[id])).rows[0].n,0);
 await db.query("INSERT INTO languages(code,display_name) VALUES('de-test','Deutsch')");await service.mutate(root,'translations',id,{translations:{'de-test':'Deutsch'}});await service.mutate(root,'translations',id,{translations:{'de-test':'Neu'}});assert.equal((await service.details(root,id)).row.translations['de-test'],'Neu');assert.ok((await service.details(root,id)).languages.some(l=>l.code==='de-test'));
 await db.query("UPDATE languages SET is_active=false WHERE code='de-test'");for(const code of ['de-test','unknown'])await assert.rejects(service.mutate(root,'translations',id,{translations:{[code]:'No'}}),{code:'BRAND_INVALID_LANGUAGE'});await service.mutate(root,'translations',id,{translations:{ru:'Yes'}});assert.equal((await db.query("SELECT name FROM brand_translations WHERE brand_id=$1 AND language_code='de-test'",[id])).rows[0].name,'Neu');
});
test('Main image canonical path and ordered Gallery persist independently, duplicate constraints, safe unlink',async()=>{
 const id=await create();await service.mutate(root,'basic',id,{main_media_reference:'a.png'});await service.mutate(root,'gallery',id,{original:[],items:['a.png','b.png','c.png']});assert.equal((await stored(id)).main_media_reference,'a.png');await service.mutate(root,'gallery',id,{original:['a.png','b.png','c.png'],items:['a.png','c.png','b.png']});await service.mutate(root,'gallery',id,{original:['a.png','c.png','b.png'],items:['c.png','b.png']});assert.equal((await stored(id)).main_media_reference,'a.png');
 await service.mutate(root,'basic',id,{main_media_reference:'b.png'});await service.mutate(root,'basic',id,{main_media_reference:null});assert.deepEqual(await gallery(id),[{media_reference:'c.png',sort_order:0},{media_reference:'b.png',sort_order:1}]);for(const file of ['a.png','b.png','c.png'])assert.deepEqual(await readFile(path.join(mediaRoot,file)),pixel);
 await assert.rejects(service.mutate(root,'gallery',id,{original:['c.png','b.png'],items:['b.png','b.png']}),{code:'BRAND_DUPLICATE_MEDIA'});await assert.rejects(db.query("INSERT INTO brand_media(brand_id,media_reference,sort_order) VALUES($1,'b.png',2)",[id]),{code:'23505'});
});
test('strict independent permissions, no visibility escalation, new selection requires media.view; unlink does not',async()=>{
 const id=await create(),calls={view:()=>service.details(normal,id),create:()=>service.mutate(normal,'create',undefined,{name:'Normal'}),update:()=>service.mutate(normal,'basic',id,{name:'Renamed'}),visibility:()=>service.mutate(normal,'basic',id,{is_visible:true})};
 for(const permission of Object.keys(calls))for(const value of [undefined,false,'true',1,null,true]){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3::jsonb)',[normal.id,'brands.'+permission,JSON.stringify(value)]);for(const [key,call] of Object.entries(calls)){if(key===permission&&value===true)await call();else await assert.rejects(call(),{code:'BRAND_FORBIDDEN'});}}
 await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query("INSERT INTO cpanel_user_permissions VALUES($1,'brands.update','true')",[normal.id]);const before=(await stored(id)).is_visible;await assert.rejects(service.mutate(normal,'basic',id,{name:'Hacked',is_visible:!before}),{code:'BRAND_FORBIDDEN'});assert.equal((await stored(id)).is_visible,before);
 await assert.rejects(service.mutate(normal,'basic',id,{main_media_reference:'a.png'}),{code:'BRAND_FORBIDDEN'});await service.mutate(root,'basic',id,{main_media_reference:'a.png'});await service.mutate(normal,'basic',id,{main_media_reference:null});await service.mutate(root,'gallery',id,{original:[],items:['a.png']});await service.mutate(normal,'gallery',id,{original:['a.png'],items:[]});await service.mutate(normal,'translations',id,{translations:{ru:'Allowed'}});
 await assert.rejects(service.list({...root,sessionHash:'bad'},{}),{code:'BRAND_FORBIDDEN'});assert.deepEqual((await db.query('SELECT key FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows,[{key:'superuser'}]);
});
test('malicious fields, path attacks, non-images, cache, symlink and unknown IDs reject without writes',async()=>{
 const id=await create(),before=await stored(id);
 for(const key of ['id','created_by','updated_by','created_at','updated_at','translation_count','gallery_count','effective_name','cacheToken','url'])for(const operation of ['create','basic','translations','gallery'] as const){const data=operation==='create'||operation==='basic'?{name:'Valid'}:operation==='translations'?{translations:{ru:'Valid'}}:{original:[],items:[]};await assert.rejects(service.mutate(root,operation,operation==='create'?undefined:id,{...data,[key]:'forged'}),{code:'BRAND_INVALID_REQUEST'});}
 for(const ref of ['../a.png','../../etc/passwd','/etc/passwd','file:///etc/passwd','%2e%2e/a.png','a\0.png','a\\b.png','escape.png','fake.png','missing.png','cache/temporary.png']){await assert.rejects(service.mutate(root,'basic',id,{main_media_reference:ref}),{code:'BRAND_INVALID_MEDIA'});await assert.rejects(service.mutate(root,'gallery',id,{original:[],items:[ref]}),{code:'BRAND_INVALID_MEDIA'});}
 for(const value of ['0','-1','1 OR 1=1','999999999999999999999'])await assert.rejects(service.details(root,value),{code:'BRAND_NOT_FOUND'});assert.deepEqual(await stored(id),before);
});
test('Gallery concurrent stale saves conflict atomically; cross-Brand references never mutate the other Brand',async()=>{
 const a=await create(),b=await create();await service.mutate(root,'gallery',a,{original:[],items:['a.png','b.png','c.png']});await service.mutate(root,'gallery',b,{original:[],items:['b.png']});
 const results=await Promise.allSettled([service.mutate(root,'gallery',a,{original:['a.png','b.png','c.png'],items:['b.png','a.png','c.png']}),service.mutate(other,'gallery',a,{original:['a.png','b.png','c.png'],items:['c.png','b.png','a.png']})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.code,'BRAND_GALLERY_CONFLICT');assert.deepEqual((await gallery(a)).map(r=>r.sort_order),[0,1,2]);assert.deepEqual(new Set((await gallery(a)).map(r=>r.media_reference)),new Set(['a.png','b.png','c.png']));
 await assert.rejects(service.mutate(root,'gallery',a,{original:['b.png'],items:[]}),{code:'BRAND_GALLERY_CONFLICT'});assert.deepEqual(await gallery(b),[{media_reference:'b.png',sort_order:0}]);
});
test('transaction faults roll back translations, Gallery and Basic; no false partial persistence',async()=>{
 const id=await create();await db.query(`CREATE FUNCTION brand_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled'; END $$`);
 for(const table of ['brand_translations','brand_media','brands']){
  const condition=table==='brand_translations'?"WHEN (NEW.language_code='ru')":table==='brand_media'?'WHEN (NEW.sort_order=1)':'';
  await db.query(`CREATE TRIGGER brand_fail BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW ${condition} EXECUTE FUNCTION brand_fail()`);
  try{const operation=table==='brands'?'basic':table==='brand_media'?'gallery':'translations',input=operation==='basic'?{name:'Uncommitted'}:operation==='gallery'?{original:[],items:['a.png','b.png']}:{translations:{en:'First',ru:'Failed'}};const before=await stored(id);await assert.rejects(service.mutate(root,operation,id,input),{code:'BRAND_SAVE_FAILED'});assert.deepEqual(await stored(id),before);assert.deepEqual(await gallery(id),[]);assert.deepEqual((await service.details(root,id)).row.translations,{});}finally{await db.query(`DROP TRIGGER brand_fail ON ${table}`);}
 }
 await db.query('DROP FUNCTION brand_fail()');
});
test('missing files retain canonical relationships and render placeholders without blocking unrelated edits',async()=>{
 await writeFile(path.join(mediaRoot,'missing-later.png'),pixel);const id=await create();await service.mutate(root,'basic',id,{main_media_reference:'missing-later.png'});await service.mutate(root,'gallery',id,{original:[],items:['missing-later.png','a.png']});await rm(path.join(mediaRoot,'missing-later.png'));
 const row=(await service.details(root,id)).row;assert.equal(row.basic.mainMedia?.url,null);assert.equal(row.gallery[0].url,null);assert.equal((await stored(id)).main_media_reference,'missing-later.png');await service.mutate(root,'basic',id,{name:'Still editable'});await service.mutate(root,'gallery',id,{original:['missing-later.png','a.png'],items:['a.png','missing-later.png']});assert.equal((await gallery(id)).length,2);assert.ok((await service.list(root,{})).rows);
});
test('real base-only literal name search, default All filter and deterministic pagination',async()=>{
 const prefix=randomUUID();const id=await create(prefix+' AbC %_');await service.mutate(root,'translations',id,{translations:{ru:'UNIQUE_TRANSLATION_ONLY'}});assert.equal((await service.list(root,{query:prefix+' abc %_'})).total,1);assert.equal((await service.list(root,{query:'UNIQUE_TRANSLATION_ONLY'})).total,0);assert.equal((await service.list(root,{query:prefix,visibility:'visible'})).total,0);assert.equal((await service.list(root,{query:prefix})).total,1);await service.mutate(root,'basic',id,{is_visible:true});assert.equal((await service.list(root,{query:prefix,visibility:'visible'})).total,1);for(let i=0;i<10;i++)await create(prefix+' '+i);const first=await service.list(root,{query:prefix}),second=await service.list(root,{query:prefix,page:'2'});assert.equal(first.rows.length,9);assert.equal(second.rows.length,2);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,11);
});

test('all populated persistence scopes remain isolated; real overrides and cleared values resolve to base',async()=>{
 const {contentText}=await import('../../src/public/cpanel/js/content/editor-state.js');
 const brand=await create('Base original');
 await service.mutate(root,'basic',brand,{main_media_reference:'a.png',is_visible:true});
 await service.mutate(root,'translations',brand,{translations:{tm:'At',ru:'Имя'}});
 await service.mutate(root,'gallery',brand,{original:[],items:['b.png','c.png']});
 const basic=async()=>{const row=await stored(brand);return {name:row.name,main:row.main_media_reference,visible:row.is_visible};};
 const translations=async()=>(await db.query('SELECT * FROM brand_translations WHERE brand_id=$1 ORDER BY language_code',[brand])).rows;
 const media=async()=>(await db.query('SELECT * FROM brand_media WHERE brand_id=$1 ORDER BY sort_order',[brand])).rows;
 const initialBasic=await basic(),initialMedia=await media();
 await service.mutate(root,'translations',brand,{translations:{ru:'Новое имя',en:'   '}});
 assert.deepEqual(await basic(),initialBasic);assert.deepEqual(await media(),initialMedia);
 let result=(await service.details(root,brand)).row;
 assert.equal(contentText(result.basic.name,result.translations.ru),'Новое имя');
 assert.equal(contentText(result.basic.name,result.translations.en),'Base original');
 assert.equal((await service.details(root,brand)).languages.filter(l=>result.translations[l.code]?.trim()).length,2);
 const savedTranslations=await translations();
 await service.mutate(root,'basic',brand,{name:'Base changed',main_media_reference:'c.png',is_visible:false});
 assert.deepEqual(await translations(),savedTranslations);assert.deepEqual(await media(),initialMedia);
 const savedBasic=await basic();
 await service.mutate(root,'gallery',brand,{original:['b.png','c.png'],items:['c.png','b.png']});
 assert.deepEqual(await basic(),savedBasic);assert.deepEqual(await translations(),savedTranslations);
 await service.mutate(root,'translations',brand,{translations:{ru:'   '}});
 result=(await service.details(root,brand)).row;
 assert.equal(result.translations.ru,undefined);assert.equal(contentText(result.basic.name,result.translations.ru),'Base changed');
 assert.equal((await service.details(root,brand)).languages.filter(l=>result.translations[l.code]?.trim()).length,1);
 assert.equal((await db.query("SELECT 1 FROM brand_translations WHERE brand_id=$1 AND language_code='ru'",[brand])).rowCount,0);
});
