import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {sanitizeDescription} from '../../src/content/html.js';
import {pool} from '../../src/database/pool.js';
import {config} from '../../src/config/env.js';
import {migrate} from '../../src/database/migrate.js';
import {bootstrapSuperuser} from '../../src/cpanel/auth/bootstrap.js';
import {SessionRepository} from '../../src/cpanel/auth/sessions.js';
import {OptionTypesRepository,type TypeActor} from '../../src/option-types/repository.js';
import {OptionTypesService} from '../../src/option-types/service.js';
const schema='html_description_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});let actor:TypeActor;
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);const u=await bootstrapSuperuser({name:'HTML test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);actor={id:u.id,sessionHash:(await new SessionRepository(db).create(u.id)).session.token_hash};});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();});
const allowed='<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u><br /><a href="https://example.com">Link</a></p><ul><li>Cash</li></ul><ol><li>Card</li></ol>';
test('central HTML allowlist preserves formatting and legacy text; strips active content and unsafe URLs',()=>{
 assert.equal(sanitizeDescription(allowed),allowed);assert.equal(sanitizeDescription('Cash & card\nOn arrival'),'<p>Cash &amp; card<br />On arrival</p>');assert.equal(sanitizeDescription('<p><br></p>'),'');
 for(const evil of ['<script>alert(1)</script>','<style>body{display:none}</style>','<iframe src="https://example.com">bad</iframe>','<object>bad</object>','<svg onload="alert(1)"><script>bad</script></svg>'])assert.equal(sanitizeDescription(evil),'');
 const safe=sanitizeDescription('<p onclick="bad()" style="color:red">OK<img src=x onerror=bad()><a href="javascript:alert(1)" onmouseover="bad()">bad</a><a href="jav&#x61;script:bad">bad2</a></p>');assert.equal(safe,'<p>OK<img src="x" /><a>bad</a><a>bad2</a></p>');
 assert.equal(sanitizeDescription('<a href="mailto:help@example.com" target="_blank">Help</a>'),'<a href="mailto:help@example.com" target="_blank" rel="noopener noreferrer">Help</a>');
});
for(const kind of ['payment','delivery','order-status']as const)test(kind+' base/translated Description HTML persists safely; legacy read and fallback remain usable',async()=>{
 const repository=new OptionTypesRepository(kind,db),s=new OptionTypesService(repository),id=(await s.mutate(actor,'create',undefined,{name:'Plain <name>',description:allowed+'<script>bad()</script>'})).row.id;
 assert.equal((await db.query(`SELECT description FROM ${repository.table} WHERE id=$1`,[id])).rows[0].description,allowed);
 await s.mutate(actor,'translations',id,{field:'description',translations:{ru:'<p onclick="bad()"><b>Перевод</b></p>',en:'<p><br></p>'}});const row=(await s.detail(actor,id)).row;assert.equal(row.translations.description.ru,'<p><b>Перевод</b></p>');assert.equal(row.translations.description.en,undefined);assert.equal(row.basic.description,allowed);assert.equal(row.basic.name,'Plain <name>');
 await db.query(`UPDATE ${repository.table} SET description=$2 WHERE id=$1`,[id,'Legacy & text\nLine two']);assert.equal((await s.detail(actor,id)).row.basic.description,'<p>Legacy &amp; text<br />Line two</p>');assert.equal((await db.query(`SELECT description FROM ${repository.table} WHERE id=$1`,[id])).rows[0].description,'Legacy & text\nLine two');
 await s.mutate(actor,'basic',id,{description:'<p onload="bad()">Saved <a href="javascript:bad">name</a></p>'});assert.equal((await s.detail(actor,id)).row.basic.description,'<p>Saved <a>name</a></p>');
});

test('manual HTML preserves presentation and image-only values, blocks executable CSS/URLs/attributes',()=>{
 const html=sanitizeDescription('<div class="delivery-info" style="text-align:center;padding:10px;position:fixed;background:url(javascript:bad);width:expression(bad)"><img src="/media/example.png" alt="Delivery" style="max-width:120px" onerror="bad()"><h2>Free</h2><table><tr><td colspan="2">Delivery</td></tr></table></div>');
 assert.match(html,/class="delivery-info"/);assert.match(html,/text-align:center/);assert.match(html,/padding:10px/);assert.match(html,/max-width:120px/);assert.match(html,/<img src="\/media\/example.png"/);assert.match(html,/<h2>Free<\/h2>/);assert.match(html,/colspan="2"/);assert.doesNotMatch(html,/position|background|expression|onerror/);
 assert.match(sanitizeDescription('<img src="/media/a.png">'),/<img/);
 for(const src of ['javascript:alert(1)','vbscript:bad','data:image/svg+xml,bad','//example.com/x'])assert.doesNotMatch(sanitizeDescription('<img src="'+src+'" onload="bad()">'),/src=/);
 for(const css of ['width:expression(alert(1))','margin:-999px','padding:var(--attack)','display:contents','height:calc(100vh)','background-image:url(https://evil.test)'])assert.doesNotMatch(sanitizeDescription('<p style="'+css+'">Safe</p>'),/style=/);
});
