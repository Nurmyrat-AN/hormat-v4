import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {DiscountsRepository,type DiscountActor} from '../../src/discounts/repository.js';
import {DiscountsService} from '../../src/discounts/service.js';
import {VendorCredentials} from '../../src/vendors/credentials.js';
const schema='discounts_test_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`}),service=new DiscountsService(new DiscountsRepository(db));
let root:DiscountActor,normal:DiscountActor;
async function actor(superuser:boolean){const user=await bootstrapSuperuser({name:'Discount test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);if(!superuser)await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[user.id]);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
const create=async(name='Discount '+randomUUID())=>(await service.mutate(root,'create',undefined,{name,priority:10})).row.id;
const stored=async(id:string)=>(await db.query('SELECT * FROM discounts WHERE id=$1',[id])).rows[0];
const rule=(kind='removePercent',value:string|null='10')=>({before_action:kind,before_value:value,after_action:'fixed',after_value:'20.1234567890123456789'});
async function grants(values:Record<string,unknown>){await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);for(const [key,value]of Object.entries(values))await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor(true);normal=await actor(false);});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
test('Discount schema/defaults and minimum Create; no Product column or computed count',async()=>{
 const id=await create('  Base  '),row=await stored(id);assert.equal(row.name,'Base');assert.equal(row.is_visible,false);assert.equal(row.is_visible_on_product,false);for(const key of ['starts_at','ends_at','before_value','after_value'])assert.equal(row[key],null);
 assert.equal((await db.query('SELECT * FROM discount_translations WHERE discount_id=$1',[id])).rowCount,0);
 const columns=(await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name IN('discounts','products')",[schema])).rows;
 assert.ok(!columns.some(r=>r.column_name==='products_count'||r.table_name==='products'&&r.column_name==='discount_id'));
 for(const key of ['before_value','after_value'])assert.equal(columns.find(r=>r.table_name==='discounts'&&r.column_name===key).data_type,'numeric');
 for(const body of [{name:'',priority:0},{name:'A',priority:1.5},{name:'A',priority:'1'},{name:'A',priority:2147483648},{name:'A',priority:1,is_visible:true},{name:'A',priority:1,is_visible_on_product:true},{name:'A',priority:1,created_by:root.id}])await assert.rejects(service.mutate(root,'create',undefined,body));
});
test('Basic, Rules and Name overrides save independently; blank overrides fall back; rollback',async()=>{
 const id=await create('Fallback');await service.mutate(root,'rules',id,rule());await service.mutate(root,'translations',id,{translations:{ru:' Имя ',en:'English'}});
 await service.mutate(root,'basic',id,{name:'Changed',priority:-7,is_visible:true,is_visible_on_product:true,starts_at:'2027-01-01T10:00:00.000Z',ends_at:null});let row=await stored(id);assert.equal(row.before_value,'10');assert.equal(row.after_value,'20.1234567890123456789');assert.equal(row.priority,-7);assert.equal(row.is_visible_on_product,true);
 await service.mutate(root,'rules',id,rule('addAmount','8.5'));assert.equal((await stored(id)).name,'Changed');assert.equal((await stored(id)).is_visible,true);
 await service.mutate(root,'translations',id,{translations:{ru:'   '}});const detail=(await service.details(root,id)).row;assert.equal(detail.translations.ru,undefined);assert.equal(detail.basic.name,'Changed');assert.equal(detail.translations.en,'English');assert.equal(detail.rules.before.value,'8.5');
 await assert.rejects(service.mutate(root,'basic',id,{before_value:'5'}));await assert.rejects(service.mutate(root,'rules',id,{...rule(),priority:99}));await assert.rejects(service.mutate(root,'translations',id,{translations:{unknown:'Bad'}}));
 await db.query(`CREATE FUNCTION reject_discount_translation() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.name='FAIL' THEN RAISE EXCEPTION 'forced'; END IF; RETURN NEW; END$$; CREATE TRIGGER fail_translation BEFORE INSERT OR UPDATE ON discount_translations FOR EACH ROW EXECUTE FUNCTION reject_discount_translation()`);
 await assert.rejects(service.mutate(root,'translations',id,{translations:{en:'Must roll back',ru:'FAIL'}}),{code:'DISCOUNT_SAVE_FAILED'});assert.equal((await service.details(root,id)).row.translations.en,'English');
 await assert.rejects(db.query('INSERT INTO discount_translations(discount_id,language_code,name) VALUES($1,\'en\',\'duplicate\')',[id]),{code:'23505'});
});
test('Date instants/null ranges and strict server-managed/boolean/ID validation',async()=>{
 const id=await create();for(const body of [{starts_at:'2027-02-01T00:00:00.000Z',ends_at:'2027-01-01T00:00:00.000Z'},{starts_at:'2027-02-30T00:00:00Z'},{starts_at:'2027-01-01T00:00'},{starts_at:'infinity'},{is_visible:'true'},{is_visible_on_product:1},{updated_by:root.id}])await assert.rejects(service.mutate(root,'basic',id,body));
 await service.mutate(root,'basic',id,{starts_at:'2027-01-01T00:00:00.123Z',ends_at:'2027-01-01T00:00:00.123Z'});assert.equal((await stored(id)).starts_at.toISOString(),'2027-01-01T00:00:00.123Z');await service.mutate(root,'basic',id,{starts_at:null,ends_at:null});assert.equal((await stored(id)).ends_at,null);
 await assert.rejects(service.details(root,'../../'),{code:'DISCOUNT_NOT_FOUND'});await assert.rejects(service.details(root,'9223372036854775807'),{code:'DISCOUNT_NOT_FOUND'});
});
test('All five actions, exact decimal persistence, NULL and 0–100 percent bounds',async()=>{
 const id=await create();for(const kind of ['addAmount','addPercent','fixed','removeAmount','removePercent']){await service.mutate(root,'rules',id,rule(kind,'0.1234567890123456789'));assert.equal((await stored(id)).before_action,kind);assert.equal((await stored(id)).before_value,'0.1234567890123456789');}
 for(const value of ['0','100',null])await service.mutate(root,'rules',id,rule('addPercent',value));
 for(const value of ['100.0000000000000000001','101','-1','NaN','Infinity','1e2','',{},true,5])await assert.rejects(service.mutate(root,'rules',id,{...rule(),before_value:value}));
 await assert.rejects(service.mutate(root,'rules',id,rule('bad','1')));await service.mutate(root,'rules',id,rule('fixed','101.5'));
 await assert.rejects(db.query("UPDATE discounts SET before_action='addPercent',before_value=101 WHERE id=$1",[id]),{code:'23514'});
});
test('Independent exact boolean permissions and visibility versus name-presentation flag',async()=>{
 const id=await create();for(const value of [false,'true',1,null]){await grants({'discounts.update':value});await assert.rejects(service.mutate(normal,'basic',id,{name:'No'}),{code:'DISCOUNT_FORBIDDEN'});}
 await grants({'discounts.view':true});await service.list(normal,{});await service.details(normal,id);await assert.rejects(service.mutate(normal,'rules',id,rule()),{code:'DISCOUNT_FORBIDDEN'});
 await grants({'discounts.create':true});await service.mutate(normal,'create',undefined,{name:'Create only',priority:0});await assert.rejects(service.list(normal,{}),{code:'DISCOUNT_FORBIDDEN'});
 await grants({'discounts.update':true});await service.mutate(normal,'basic',id,{is_visible_on_product:true});await service.mutate(normal,'rules',id,rule());await service.mutate(normal,'translations',id,{translations:{tm:'At'}});await assert.rejects(service.mutate(normal,'basic',id,{is_visible:true}),{code:'DISCOUNT_FORBIDDEN'});assert.equal((await stored(id)).is_visible,false);
 await grants({'discounts.visibility':true});await service.mutate(normal,'basic',id,{is_visible:true});await assert.rejects(service.mutate(normal,'basic',id,{is_visible_on_product:false}),{code:'DISCOUNT_FORBIDDEN'});await assert.rejects(service.mutate(normal,'rules',id,rule()),{code:'DISCOUNT_FORBIDDEN'});
 await db.query('DELETE FROM cpanel_sessions WHERE user_id=$1',[normal.id]);await assert.rejects(service.mutate(normal,'basic',id,{is_visible:false}),{code:'DISCOUNT_FORBIDDEN'});
});
test('Many-to-many FK/uniqueness and real counts in list/details; search is parameterized',async()=>{
 const a=await create('Count Needle %'),b=await create('Count Other');
 const vendor=(await db.query("INSERT INTO vendors(name,url,username,password_encrypted,is_active) VALUES('fixture','https://example.invalid/db','fixture',$1,false) RETURNING id",[new VendorCredentials(config.vendors.credentialsKey).encryptSecret('fixture')])).rows[0].id;
 const source=(await db.query("INSERT INTO source_products(vendor_id,source_id,name) VALUES($1,'discount-count','Count fixture') RETURNING id",[vendor])).rows[0].id;
 const products=(await db.query('INSERT INTO products(source_product_id,name) SELECT $1,\'Fixture Product\' FROM generate_series(1,2) RETURNING id',[source])).rows;
 for(const [product,discount]of [[products[0].id,a],[products[0].id,b],[products[1].id,a]])await db.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2)',[product,discount]);
 await assert.rejects(db.query('INSERT INTO product_discounts(product_id,discount_id) VALUES($1,$2)',[products[0].id,a]),{code:'23505'});await assert.rejects(db.query('INSERT INTO product_discounts(product_id,discount_id) VALUES(9223372036854775807,$1)',[a]),{code:'23503'});
 assert.equal((await service.details(root,a)).row.productCount,2);assert.equal((await service.details(root,b)).row.productCount,1);const result=await service.list(root,{query:'%'});assert.deepEqual(result.rows.map(row=>row.id),[a]);assert.equal(result.rows[0].productCount,2);
 assert.equal((await service.list(root,{query:"' OR true --"})).rows.length,0);await service.mutate(root,'basic',a,{is_visible:true});assert.equal((await service.list(root,{query:'Count',visibility:'visible'})).rows[0].id,a);
});
