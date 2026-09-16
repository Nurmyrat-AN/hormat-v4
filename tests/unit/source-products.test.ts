import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {config} from '../../src/config/env.js';
import {pool} from '../../src/database/pool.js';
import {migrate} from '../../src/database/migrate.js';
import {SourceProductsService} from '../../src/source-products/service.js';
import {sourceBrowserFixture} from '../fixtures/source-browser.js';
const schema='source_browser_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:'-c search_path='+schema}),service=new SourceProductsService(db),access={hasPermission:async()=>true};let fixture:Awaited<ReturnType<typeof sourceBrowserFixture>>;
before(async()=>{await pool.query('CREATE SCHEMA '+schema);await migrate(db);fixture=await sourceBrowserFixture(db);});
after(async()=>{await db.end();await pool.query('DROP SCHEMA '+schema+' CASCADE');await pool.end();});
test('real source search, pagination, identity strings and stable order without multiplying rows',async()=>{
 const list=await service.list(access,{vendor:fixture.vendors[0]});assert.equal(list.total,15);assert.equal(list.rows.length,12);assert.equal(list.rows[0].stock,'5');assert.equal(list.rows[0].product_count,2);assert.equal(list.rows[0].barcode_count,2);assert.equal(list.rows[0].price,'12.345678');
 const second=await service.list(access,{vendor:fixture.vendors[0],page:'2'});assert.equal(second.rows.length,3);assert.ok(!second.rows.some(r=>list.rows.some(x=>x.id===r.id)));
 for(const [field,query,count]of [['name',fixture.prefix,16],['source_id','00X-0',2],['barcode','000123',16],...Array.from({length:5},(_,i)=>['property_'+(i+1),'P'+(i+1),16]),['all','000124',16]] as [string,string,number][]){assert.equal((await service.list(access,{field,query})).total,count);}
 assert.equal((await service.list(access,{query:"%' OR true --"})).total,0);
});
test('real AND filters and details preserve negative stock, barcode strings and vendor isolation',async()=>{
 for(const [key,value,count]of [['vendor',fixture.vendors[0],15],['active','inactive',1],['currency',fixture.currency,15],['measure',fixture.measure,15],['stock','out',1],['connection','has',2],['connection','none',14]] as [string,string,number][]){assert.equal((await service.list(access,{[key]:value})).total,count);}
 const q={vendor:fixture.vendors[0],active:'active',currency:fixture.currency,measure:fixture.measure,stock:'in',connection:'has',property_1:'P1',field:'source_id',query:'00X-0'};assert.equal((await service.list(access,q)).total,1);
 const detail=(await service.details(access,fixture.ids[1])).row;assert.equal(detail.stock,'-4');assert.deepEqual(detail.barcodes,['000123','000124']);assert.equal(detail.stocks.length,2);assert.equal(detail.product_count,0);
 assert.equal((await service.options(access,{kind:'currency',vendor:fixture.vendors[0]})).options.length,1);
});
test('invalid query and permission deny before reads; read operations do not change source data',async()=>{
 for(const query of [{field:'price'},{sort:'SQL'},{page:'0'},{page:['1']},{vendor:'x'},{currency:'-1'},{measure:'999999999999999999999'},{active:'yes'},{stock:'negative'},{connection:'true'},{property_1:[]},{unknown:'x'}])await assert.rejects(service.list(access,query));
 await assert.rejects(service.list({hasPermission:async()=>false},{}),{status:403});await assert.rejects(service.details(access,'../'),{status:400});
 const before=(await db.query('SELECT row_to_json(p) AS row FROM source_products p ORDER BY id')).rows;await service.list(access,{});await service.details(access,fixture.ids[0]);assert.deepEqual((await db.query('SELECT row_to_json(p) AS row FROM source_products p ORDER BY id')).rows,before);
});
test('Vendor A/B/clear and name + stock + advanced filters combine on PostgreSQL vendor IDs',async()=>{
 for(const [vendor,count]of [[fixture.vendors[0],15],[fixture.vendors[1],1]] as const){const result=await service.list(access,{vendor});assert.equal(result.total,count);assert.ok(result.rows.every(row=>row.vendor.id===vendor));}
 assert.equal((await service.list(access,{})).total,16);
 const result=await service.list(access,{vendor:fixture.vendors[0],query:fixture.prefix,stock:'out',active:'inactive',property_1:'P1'});assert.equal(result.total,1);assert.equal(result.rows[0].vendor.id,fixture.vendors[0]);assert.equal(result.rows[0].stock,'-4');
});
test('bounded allowlisted lookup search, pagination, selected hydration and authorization',async()=>{
 const prefix='Lookup-'+randomUUID();const ids:string[]=[];
 for(let n=0;n<25;n++)ids.push((await db.query('INSERT INTO vendors(name,url,username,password_encrypted,is_active) SELECT $1,url,username,password_encrypted,false FROM vendors WHERE id=$2 RETURNING id::text',[prefix+' '+String(n).padStart(2,'0'),fixture.vendors[0]])).rows[0].id);
 const first=await service.options(access,{kind:'vendor',query:prefix});assert.equal(first.options.length,20);assert.equal(first.hasMore,true);assert.equal(first.nextPage,2);
 const second=await service.options(access,{kind:'vendor',query:prefix,page:'2'});assert.equal(second.options.length,5);assert.equal(second.hasMore,false);assert.ok(!second.options.some(item=>first.options.some(old=>old.value===item.value)));
 const hydrated=await service.options(access,{kind:'vendor',selected:ids[24]});assert.equal(hydrated.options.length,1);assert.equal(hydrated.options[0].value,ids[24]);assert.equal(hydrated.options[0].label,prefix+' 24');
 assert.equal((await service.options(access,{kind:'vendor',query:prefix+' missing'})).options.length,0);
 assert.equal((await service.options(access,{kind:'currency',vendor:fixture.vendors[1],selected:fixture.currency})).options.length,0);
 for(const raw of [{kind:'users'},{kind:'vendor',page:'0'},{kind:'vendor',selected:'x'},{kind:'vendor',query:[]},{kind:'vendor',table:'cpanel_users'}])await assert.rejects(service.options(access,raw),{status:400});
 await assert.rejects(service.options({hasPermission:async()=>false},{kind:'vendor'}),{status:403});
});
