import {VendorCredentials} from '../../src/vendors/credentials.js';
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
import {CategoriesRepository,type CategoryActor} from '../../src/categories/repository.js';
import {CategoriesService} from '../../src/categories/service.js';
import {MediaBrowser} from '../../src/cpanel/media/browser.js';
const schema='categories_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),repo=new CategoriesRepository(db);
let root:CategoryActor,other:CategoryActor,normal:CategoryActor,mediaRoot:string,service:CategoriesService;
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64');
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Category test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
const create=async(name='Category '+randomUUID(),parent_id:string|null=null)=>(await service.mutate(root,'create',undefined,{name,parent_id})).row.id;
const stored=async(id:string)=>(await db.query('SELECT * FROM categories WHERE id=$1',[id])).rows[0];
const gallery=async(id:string)=>(await db.query('SELECT media_reference,sort_order FROM category_media WHERE category_id=$1 ORDER BY sort_order',[id])).rows;
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);other=await actor(true);normal=await actor(false);mediaRoot=await mkdtemp(path.join(tmpdir(),'hormat-categories-'));for(const file of ['a.png','b.png','c.png'])await writeFile(path.join(mediaRoot,file),pixel);await mkdir(path.join(mediaRoot,'cache'));await writeFile(path.join(mediaRoot,'cache','temporary.png'),pixel);await writeFile(path.join(mediaRoot,'fake.png'),'not an image');await symlink('/etc/passwd',path.join(mediaRoot,'escape.png'));service=new CategoriesService(repo,new MediaBrowser(mediaRoot));});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();if(mediaRoot)await rm(mediaRoot,{recursive:true,force:true});});
test('Category schema, minimum Create, hidden default and nullable SEO; preserved Product columns',async()=>{
 const id=await create('Root');const row=await stored(id);assert.equal(row.parent_id,null);assert.equal(row.is_visible,false);assert.equal(row.seo_title,null);assert.equal(row.seo_description,null);assert.match(row.slug,/^category-/);assert.equal(row.main_media_reference,null);
 for(const table of ['category_translations','category_media'])assert.equal((await db.query(`SELECT * FROM ${table} WHERE category_id=$1`,[id])).rowCount,0);
 const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='products'",[schema])).rows.map(row=>row.column_name);for(const column of ['source_product_id','brand_id','category_id'])assert.ok(columns.includes(column));
 assert.equal((await db.query("SELECT * FROM information_schema.columns WHERE table_schema=$1 AND table_name='categories' AND column_name IN('direct_products','total_products','product_count')",[schema])).rowCount,0);
 await assert.rejects(db.query('UPDATE categories SET parent_id=id WHERE id=$1',[id]),{code:'23514'});
 await assert.rejects(db.query('UPDATE categories SET parent_id=9223372036854775807 WHERE id=$1',[id]),{code:'23503'});
});
test('recursive breadcrumbs/search, self and descendant rejection, subtree move and root listing',async()=>{
 const a=await create('Tree A'),b=await create('Tree B',a),c=await create('Tree C',b),d=await create('Deep Needle',c),x=await create('Tree X');
 assert.deepEqual((await service.details(root,d)).row.ancestry.map(r=>r.id),[a,b,c,d]);
 for(const parent_id of [a,b,c,d])await assert.rejects(service.mutate(root,'basic',a,{parent_id}),{code:'CATEGORY_INVALID_PARENT'});
 assert.equal((await stored(a)).parent_id,null);
 assert.deepEqual((await service.list(root,{parent:a})).rows.map(row=>row.id),[b]);
 assert.ok((await service.list(root,{})).rows.some(row=>row.id===a));assert.ok(!(await service.list(root,{})).rows.some(row=>row.id===d));
 const found=(await service.list(root,{query:'Needle'})).rows;assert.equal(found.length,1);assert.deepEqual(found[0].ancestry.map(row=>row.id),[a,b,c,d]);
 for(const row of (await service.list(root,{query:'Tree',exclude:a})).rows.filter(row=>[a,b,c].includes(row.id)))assert.equal(row.parentDisabled,true);
 await service.mutate(root,'basic',b,{parent_id:x});assert.equal((await stored(c)).parent_id,b);assert.equal((await stored(d)).parent_id,c);assert.deepEqual((await service.details(root,d)).row.ancestry.map(row=>row.id),[x,b,c,d]);assert.equal((await service.details(root,a)).row.childCount,0);
 await service.mutate(root,'basic',x,{is_visible:true});assert.equal((await stored(b)).is_visible,false);
});
test('concurrent inverse moves serialize and cannot create cycles; malformed ancestry fails finitely',async()=>{
 const a=await create(),b=await create();const results=await Promise.allSettled([service.mutate(root,'basic',a,{parent_id:b}),service.mutate(other,'basic',b,{parent_id:a})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 // Trusted direct SQL can bypass application graph checks; read paths still must terminate safely.
 const c=await create(),d=await create('Malformed child',c);await db.query('UPDATE categories SET parent_id=$2 WHERE id=$1',[c,d]);await assert.rejects(service.details(root,d),{code:'CATEGORY_INVALID_PARENT'});await db.query('UPDATE categories SET parent_id=NULL WHERE id=$1',[c]);
});
test('real direct/recursive counts are batched and update after moving a subtree',async()=>{
 const vendor=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES('fixture','https://example.invalid/db','fixture',$1,false) RETURNING id",[new VendorCredentials(config.vendors.credentialsKey).encryptSecret('fixture')])).rows[0].id;
 const source=(await db.query("INSERT INTO source_products(vendor_id,source_id,name) VALUES($1,'category-count','Count fixture') RETURNING id",[vendor])).rows[0].id;
 const a=await create('Count A'),b=await create('Count B',a),c=await create('Count C',b),x=await create('Count X');
 for(const [id,count]of [[a,2],[b,3],[c,4]] as const)await db.query('INSERT INTO products(source_product_id,category_id,name) SELECT $1,$2,\'Fixture Product\' FROM generate_series(1,$3::int)',[source,id,count]);
 for(const [id,direct,total]of [[a,2,9],[b,3,7],[c,4,4]] as const){const row=(await service.details(root,id)).row;assert.equal(row.directProducts,direct);assert.equal(row.totalProducts,total);const list=(await service.list(root,{query:'Count'})).rows.find(row=>row.id===id)!;assert.equal(list.totalProducts,total);}
 await service.mutate(root,'basic',b,{parent_id:x});assert.equal((await service.details(root,a)).row.totalProducts,2);assert.equal((await service.details(root,x)).row.totalProducts,7);
 await assert.rejects(db.query('INSERT INTO products(source_product_id,category_id,name) VALUES($1,9223372036854775807,\'Fixture Product\')',[source]),{code:'23503'});
 assert.equal((await db.query('SELECT count(*) FROM products WHERE source_product_id=$1',[source])).rows[0].count,'9');
});
test('Basic, SEO and field translations persist independently and empty overrides fall back',async()=>{
 const id=await create('Base');await service.mutate(root,'seo',id,{slug:' CATEGORY Test ',seo_title:' Base SEO ',seo_description:' Description '});assert.equal((await stored(id)).slug,'category-test');
 for(const [field,value]of [['name','Имя'],['seo_title','Заголовок'],['seo_description','Описание']])await service.mutate(root,'translations',id,{field,translations:{ru:value}});
 await service.mutate(root,'translations',id,{field:'seo_title',translations:{ru:'  '}});let row=(await service.details(root,id)).row;assert.equal(row.translations.ru,'Имя');assert.equal(row.seoTranslations.seo_description.ru,'Описание');assert.equal(row.seoTranslations.seo_title.ru,undefined);assert.equal(row.seo.seo_title,'Base SEO');
 await service.mutate(root,'basic',id,{name:'Changed'});assert.equal((await stored(id)).seo_title,'Base SEO');await service.mutate(root,'seo',id,{seo_title:''});assert.equal((await stored(id)).seo_title,null);assert.equal((await stored(id)).name,'Changed');
 const another=await create();await assert.rejects(service.mutate(root,'seo',another,{slug:'category-test'}),{code:'CATEGORY_SLUG_TAKEN'});
 for(const slug of ['../escape','a--b','x'.repeat(121)])await assert.rejects(service.mutate(root,'seo',id,{slug}),{code:'CATEGORY_INVALID_SLUG'});
 await assert.rejects(service.mutate(root,'basic',id,{seo_title:'wrong scope'}),{code:'CATEGORY_INVALID_REQUEST'});await assert.rejects(service.mutate(root,'seo',id,{name:'wrong scope'}),{code:'CATEGORY_INVALID_REQUEST'});await assert.rejects(service.mutate(root,'translations',id,{field:'name',translations:{unknown:'bad'}}),{code:'CATEGORY_INVALID_LANGUAGE'});
 for(const body of [{id:'1',name:'bad'},{name:' ',parent_id:null},{name:'Bad',parent_id:{id:'1'}}])await assert.rejects(service.mutate(root,'create',undefined,body));
});
test('Main Image/Gallery use real safe media, independent order, conflict and unlink without file deletion',async()=>{
 const id=await create();await service.mutate(root,'basic',id,{main_media_reference:'a.png'});await service.mutate(root,'gallery',id,{original:[],items:['a.png','b.png']});await service.mutate(root,'gallery',id,{original:['a.png','b.png'],items:['b.png','a.png']});assert.deepEqual((await gallery(id)).map(row=>row.media_reference),['b.png','a.png']);
 await assert.rejects(service.mutate(root,'gallery',id,{original:['a.png','b.png'],items:[]}),{code:'CATEGORY_GALLERY_CONFLICT'});
 await service.mutate(root,'gallery',id,{original:['b.png','a.png'],items:['b.png']});assert.equal((await stored(id)).main_media_reference,'a.png');assert.deepEqual(await readFile(path.join(mediaRoot,'a.png')),pixel);
 for(const ref of ['../etc/passwd','/etc/passwd','cache/temporary.png','fake.png','escape.png'])await assert.rejects(service.mutate(root,'basic',id,{main_media_reference:ref}),{code:'CATEGORY_INVALID_MEDIA'});
 await assert.rejects(service.mutate(root,'gallery',id,{original:['b.png'],items:['b.png','b.png']}),{code:'CATEGORY_DUPLICATE_MEDIA'});
});
test('independent permissions, strict boolean grants, visibility escalation rejection and Media selection boundary',async()=>{
 const id=await create();const grant=async(key:string,value:unknown=true)=>{await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3::jsonb)',[normal.id,key,JSON.stringify(value)]);};
 for(const value of [false,'true',1,null]){await grant('categories.update',value);await assert.rejects(service.mutate(normal,'basic',id,{name:'denied'}),{code:'CATEGORY_FORBIDDEN'});}
 await grant('categories.view');await service.details(normal,id);await assert.rejects(service.mutate(normal,'basic',id,{name:'denied'}),{code:'CATEGORY_FORBIDDEN'});
 await grant('categories.update');await service.mutate(normal,'basic',id,{name:'Allowed'});await assert.rejects(service.list(normal,{}),{code:'CATEGORY_FORBIDDEN'});await assert.rejects(service.mutate(normal,'basic',id,{is_visible:true}),{code:'CATEGORY_FORBIDDEN'});await assert.rejects(service.mutate(normal,'basic',id,{main_media_reference:'a.png'}),{code:'CATEGORY_FORBIDDEN'});
 await grant('categories.visibility');await service.mutate(normal,'basic',id,{is_visible:true});await assert.rejects(service.mutate(normal,'basic',id,{parent_id:null}),{code:'CATEGORY_FORBIDDEN'});
 await grant('categories.create');await service.mutate(normal,'create',undefined,{name:'Create only'});await assert.rejects(service.mutate(normal,'seo',id,{seo_title:'denied'}),{code:'CATEGORY_FORBIDDEN'});
});
test('failed multi-language SQL operation rolls back all changes',async()=>{
 const id=await create();await service.mutate(root,'translations',id,{translations:{ru:'Old'}});
 await db.query(`CREATE FUNCTION fail_category_translation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.language_code='en' THEN RAISE EXCEPTION 'controlled test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_translation BEFORE INSERT OR UPDATE ON category_translations FOR EACH ROW EXECUTE FUNCTION fail_category_translation()`);
 try{await assert.rejects(service.mutate(root,'translations',id,{translations:{ru:'New',en:'Fails'}}),{code:'CATEGORY_SAVE_FAILED'});assert.equal((await service.details(root,id)).row.translations.ru,'Old');}finally{await db.query('DROP TRIGGER fail_translation ON category_translations; DROP FUNCTION fail_category_translation()');}
});
test('Category Move preserves identity, content, subtree and Product links; recomputes ancestor counts and rejects cycles/unauthorized moves',async()=>{
 const a=await create('Move old'),x=await create('Move new'),b=await create('Move B',a),c=await create('Move C',b),d=await create('Move D',c);
 await service.mutate(root,'basic',b,{main_media_reference:'a.png',is_visible:true});await service.mutate(root,'seo',b,{seo_title:'SEO',seo_description:'Description'});await service.mutate(root,'translations',b,{translations:{ru:'Имя'}});await service.mutate(root,'gallery',b,{original:[],items:['a.png','b.png']});
 const vendor=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES('move fixture','https://example.invalid/db','fixture',$1,false) RETURNING id",[new VendorCredentials(config.vendors.credentialsKey).encryptSecret('fixture')])).rows[0].id;
 const source=(await db.query("INSERT INTO source_products(vendor_id,source_id,name) VALUES($1,'move-fixture','Fixture') RETURNING id",[vendor])).rows[0].id;
 await db.query('INSERT INTO products(source_product_id,category_id,name) VALUES($1,$2,\'Fixture Product\'),($1,$3,\'Fixture Product\')',[source,b,d]);
 const before=await stored(b),children=[await stored(c),await stored(d)],media=await gallery(b),translations=(await db.query('SELECT * FROM category_translations WHERE category_id=$1',[b])).rows,products=(await db.query('SELECT * FROM products WHERE source_product_id=$1 ORDER BY id',[source])).rows;
 assert.equal((await service.details(root,a)).row.totalProducts,2);assert.equal((await service.details(root,x)).row.totalProducts,0);
 await service.mutate(root,'basic',b,{parent_id:x});const afterMove=await stored(b);for(const key of Object.keys(before).filter(key=>!['parent_id','updated_at','updated_by'].includes(key)))assert.deepEqual(afterMove[key],before[key]);assert.equal(afterMove.parent_id,x);
 assert.deepEqual([await stored(c),await stored(d)],children);assert.deepEqual(await gallery(b),media);assert.deepEqual((await db.query('SELECT * FROM category_translations WHERE category_id=$1',[b])).rows,translations);assert.deepEqual((await db.query('SELECT * FROM products WHERE source_product_id=$1 ORDER BY id',[source])).rows,products);
 assert.equal((await service.details(root,a)).row.totalProducts,0);assert.equal((await service.details(root,x)).row.totalProducts,2);
 for(const parent_id of [b,c,d])await assert.rejects(service.mutate(root,'basic',b,{parent_id}),{code:'CATEGORY_INVALID_PARENT'});
 await assert.rejects(service.mutate(normal,'basic',b,{parent_id:null}),{code:'CATEGORY_FORBIDDEN'});
 await db.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'categories.update','true') ON CONFLICT(user_id,key) DO UPDATE SET value='true'",[normal.id]);await service.mutate(normal,'basic',b,{parent_id:null});assert.equal((await stored(b)).parent_id,null);assert.equal((await service.details(root,x)).row.totalProducts,0);assert.equal((await service.details(root,b)).row.totalProducts,2);assert.deepEqual((await db.query('SELECT * FROM products WHERE source_product_id=$1 ORDER BY id',[source])).rows,products);
});
