import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {ProductsRepository} from '../../src/products/repository.js';
import {ProductsService} from '../../src/products/service.js';
import type {ProductActor} from '../../src/products/validation.js';
import {MediaBrowser} from '../../src/cpanel/media/browser.js';
import {sourceBrowserFixture} from '../fixtures/source-browser.js';
const schema='products_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),repo=new ProductsRepository(db);
let root:ProductActor,normal:ProductActor,fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>,mediaRoot:string,service:ProductsService;
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Product test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
const create=async()=>(await service.mutate(root,'create',undefined,{name:' Test Product ',source_product_id:fixture.ids[0]})).row;
const stored=async(id:string)=>(await db.query('SELECT * FROM products WHERE id=$1',[id])).rows[0];
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64');
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);fixture=await sourceBrowserFixture(db);mediaRoot=await mkdtemp(path.join(tmpdir(),'hormat-products-'));for(const f of ['a.png','b.png','c.png'])await writeFile(path.join(mediaRoot,f),pixel);service=new ProductsService(repo,new MediaBrowser(mediaRoot));});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();if(mediaRoot)await rm(mediaRoot,{recursive:true,force:true});});
test('real Create: required fields, defaults, 1 Source to many, attribution and immutable source',async()=>{
 const a=await create(),b=await create();assert.notEqual(a.id,b.id);assert.equal(a.basic.name,'Test Product');assert.equal(a.basic.visible,false);assert.deepEqual(a.visibility,{placement:false,showStock:false,hideStock:false});assert.deepEqual(a.gallery,[]);assert.deepEqual(a.discounts,[]);assert.equal((await stored(a.id)).created_by,root.id);
 for(const input of [{name:'x'},{source_product_id:fixture.ids[0]}, {name:' ',source_product_id:fixture.ids[0]}, {name:'x',source_product_id:fixture.ids[0],is_visible:true}])await assert.rejects(service.mutate(root,'create',undefined,input));
 await assert.rejects(service.mutate(root,'basic',a.id,{source_product_id:fixture.ids[1]}));await assert.rejects(db.query('UPDATE products SET source_product_id=$2 WHERE id=$1',[a.id,fixture.ids[1]]));assert.equal((await stored(a.id)).source_product_id,fixture.ids[0]);assert.ok((await service.list(root)).rows.some(r=>r.id===a.id));
});
test('Basic, SEO, Description and translations persist independently with safe HTML/fallback',async()=>{
 const a=await create();const brand=(await db.query("INSERT INTO brands(name,slug) VALUES('Brand',$1) RETURNING id",[randomUUID()])).rows[0].id,category=(await db.query("INSERT INTO categories(name,slug) VALUES('Category',$1) RETURNING id",[randomUUID()])).rows[0].id;
 await service.mutate(root,'basic',a.id,{name:'Base',brand_id:brand,category_id:category,is_visible:true});
 await service.mutate(root,'seo',a.id,{slug:' Test Slug ',seo_title:'SEO',seo_description:'Search'});
 const html='<div class="safe" style="text-align:center"><img src="/media/a.png" onerror="alert(1)"><script>bad()</script><p><b>Rich</b></p><a href="javascript:bad()">Link</a></div>';
 await service.mutate(root,'description',a.id,{short_description:'Short',description_html:html});
 for(const field of ['name','seo_title','seo_description','short_description','description_html'])await service.mutate(root,'translations',a.id,{field,translations:{ru:field==='description_html'?html:'Russian '+field}});
 let row=(await service.details(root,a.id)).row;assert.equal(row.basic.brand,brand);assert.equal(row.basic.category,category);assert.equal(row.seo.slug,'test-slug');assert.match(row.description.html,/class="safe"/);assert.match(row.description.html,/text-align:center/);assert.doesNotMatch(row.description.html,/script|onerror/);assert.doesNotMatch(row.translations.description.ru,/script|onerror/);assert.equal(row.basic.name,'Base');assert.equal(row.translations.name.ru,'Russian name');
 await service.mutate(root,'translations',a.id,{field:'name',translations:{ru:' '}});row=(await service.details(root,a.id)).row;assert.equal(row.translations.name.ru??row.basic.name,'Base');assert.equal(row.translations.seo_title.ru,'Russian seo_title');
 for(const lang of ['unknown',''])await assert.rejects(service.mutate(root,'translations',a.id,{field:'name',translations:{[lang]:'bad'}}));
 await assert.rejects(service.mutate(root,'basic',a.id,{seo_title:'bad'}));await assert.rejects(service.mutate(root,'seo',a.id,{name:'bad'}));assert.equal((await stored(a.id)).seo_title,'SEO');
});
test('visibility flags combine without stock writes; diagnostics use real source, vendor, brand and category',async()=>{
 const a=await create(),stock=(await db.query('SELECT * FROM product_stocks ORDER BY id')).rows;
 await service.mutate(root,'visibility',a.id,{is_placement_product:true,show_as_in_stock:true,hide_when_out_of_stock:true});const row=(await service.details(root,a.id)).row;assert.deepEqual(row.visibility,{placement:true,showStock:true,hideStock:true});assert.equal(row.diagnostics.vendorActive,false);assert.equal(row.diagnostics.sourceActive,true);assert.equal(row.diagnostics.stockPassed,true);assert.deepEqual((await db.query('SELECT * FROM product_stocks ORDER BY id')).rows,stock);
});
test('five exact NUMERIC price actions and missing/configured rate; preview does not write',async()=>{
 const a=await create();await db.query('UPDATE source_products SET price=12 WHERE id=$1',[fixture.ids[0]]);
 assert.equal((await service.details(root,a.id)).row.preview.normal,'12');
 await db.query('INSERT INTO vendor_currency_rates(vendor_id,currency_id,rate) VALUES($1,$2,20)',[fixture.vendors[0],fixture.currency]);
 for(const [action,value,expected]of [['addAmount','0.01','240.01'],['addPercent','25','300'],['fixed','19.99','19.99'],['removeAmount','5','235'],['removePercent','25','180']]){
  const row=(await service.mutate(root,'priceRules',a.id,{price_action:action,price_value:value})).row;assert.equal(Number(row.preview.normal),Number(expected));assert.equal(row.preview.normalized,'240');assert.equal(row.priceRules.value,value);
 }
 const before=await stored(a.id);assert.equal((await service.pricePreview(root,a.id,{price_action:'fixed',price_value:'0.12345678901234567890123456789'})).preview.normal,'0.12345678901234567890123456789');assert.deepEqual(await stored(a.id),before);
 await service.mutate(root,'priceRules',a.id,{price_action:null,price_value:null});assert.equal((await stored(a.id)).price_value,null);
 for(const bad of [{price_action:'other',price_value:'1'},{price_action:'fixed',price_value:-1},{price_action:'fixed',price_value:'NaN'},{price_action:'fixed',price_value:'-1'}])await assert.rejects(service.mutate(root,'priceRules',a.id,bad));
 await db.query('DELETE FROM vendor_currency_rates WHERE currency_id=$1',[fixture.currency]);
});
test('Discount attachments: duplicate protection, priority DESC/id, detach and independent definitions',async()=>{
 const a=await create(),ids=[];for(const priority of [10,30,30])ids.push((await db.query('INSERT INTO discounts(name,priority) VALUES($1,$2) RETURNING id',['Discount '+priority,priority])).rows[0].id);
 const before=(await db.query('SELECT * FROM discounts WHERE id=ANY($1::bigint[]) ORDER BY id',[ids])).rows;
 let row=(await service.mutate(root,'discounts',a.id,{items:ids,original:[]})).row;assert.deepEqual(row.discounts,[ids[1],ids[2],ids[0]]);await assert.rejects(service.mutate(root,'discounts',a.id,{items:[ids[0],ids[0]],original:row.discounts}));row=(await service.mutate(root,'discounts',a.id,{items:[ids[0]],original:row.discounts})).row;assert.deepEqual(row.discounts,[ids[0]]);assert.deepEqual((await db.query('SELECT * FROM discounts WHERE id=ANY($1::bigint[]) ORDER BY id',[ids])).rows,before);
});
test('Gallery: primary uniqueness, reordering, unlink without deletion, stale/ownership/path safety',async()=>{
 const a=await create(),items=[{path:'a.png',primary:true},{path:'b.png',primary:false}];await service.mutate(root,'gallery',a.id,{items,original:[]});
 await assert.rejects(db.query("UPDATE product_media SET is_primary=true WHERE product_id=$1 AND media_reference='b.png'",[a.id]),{code:'23505'});
 let next=[{path:'b.png',primary:true},{path:'a.png',primary:false}];await service.mutate(root,'gallery',a.id,{items:next,original:items});await assert.rejects(service.mutate(root,'gallery',a.id,{items:[],original:items}),{code:'PRODUCT_CONFLICT'});
 await service.mutate(root,'gallery',a.id,{items:[next[1]],original:next});assert.equal((await service.details(root,a.id)).row.gallery.some(m=>m.primary),false);assert.deepEqual(await readFile(path.join(mediaRoot,'b.png')),pixel);
 for(const path of ['../a.png','/etc/passwd','cache/a.png','%2e%2e/a.png','missing.png'])await assert.rejects(service.mutate(root,'gallery',a.id,{items:[{path,primary:false}],original:[next[1]]}));
 const b=await create();await assert.rejects(service.mutate(root,'gallery',b.id,{items:[],original:[next[1]]}));assert.equal((await service.details(root,a.id)).row.gallery.length,1);
});
test('independent permissions exact true, revocation, visibility escalation and Media/Discount boundaries',async()=>{
 const a=await create();const calls={view:()=>service.details(normal,a.id),create:()=>service.mutate(normal,'create',undefined,{name:'Normal',source_product_id:fixture.ids[0]}),update:()=>service.mutate(normal,'basic',a.id,{name:'Updated'}),visibility:()=>service.mutate(normal,'basic',a.id,{is_visible:true})};
 for(const permission of Object.keys(calls))for(const value of [undefined,false,'true',1,true]){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);if(value!==undefined)await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,'products.'+permission,JSON.stringify(value)]);for(const [key,call]of Object.entries(calls))if(key===permission&&value===true)await call();else await assert.rejects(call(),{code:'PRODUCT_FORBIDDEN'});}
 await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query("INSERT INTO cpanel_user_permissions VALUES($1,'products.update','true')",[normal.id]);await assert.rejects(service.mutate(normal,'basic',a.id,{is_visible:false}),{code:'PRODUCT_FORBIDDEN'});await assert.rejects(service.mutate(normal,'gallery',a.id,{items:[{path:'a.png',primary:false}],original:[]}),{code:'PRODUCT_FORBIDDEN'});await assert.rejects(service.discounts(normal,{}),{code:'PRODUCT_FORBIDDEN'});
 const discount=(await db.query("INSERT INTO discounts(name) VALUES('D') RETURNING id")).rows[0].id;await assert.rejects(service.mutate(normal,'discounts',a.id,{items:[discount],original:[]}),{code:'PRODUCT_FORBIDDEN'});
 assert.deepEqual((await db.query('SELECT key FROM cpanel_user_permissions WHERE user_id=$1',[root.id])).rows,[{key:'superuser'}]);
});
test('malicious fields and failed transactions preserve committed Product scopes',async()=>{
 const a=await create(),before=await stored(a.id);for(const key of ['id','created_by','updated_by','source_product_id','effective_is_visible','main_media_reference'])await assert.rejects(service.mutate(root,'basic',a.id,{name:'bad',[key]:'forged'}));assert.deepEqual(await stored(a.id),before);
 await db.query(`CREATE FUNCTION product_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled'; END $$`);await db.query("CREATE TRIGGER test_fail BEFORE INSERT ON product_translations FOR EACH ROW WHEN (NEW.language_code='ru') EXECUTE FUNCTION product_test_fail()");
 try{await assert.rejects(service.mutate(root,'translations',a.id,{field:'name',translations:{en:'first',ru:'fail'}}),{code:'PRODUCT_SAVE_FAILED'});assert.deepEqual((await service.details(root,a.id)).row.translations.name,{});assert.deepEqual(await stored(a.id),before);}finally{await db.query('DROP TRIGGER test_fail ON product_translations');}
});
