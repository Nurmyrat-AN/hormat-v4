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
const schema='order_status_'+randomUUID().replaceAll('-',''),db=new pg.Pool({...config.database,options:`-c search_path=${schema}`});
let service:OptionTypesService,root:TypeActor,normal:TypeActor,folder:string,a:string,b:string;
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64');
async function actor(){const user=await bootstrapSuperuser({name:'Order status test',email:randomUUID()+'@example.invalid',password:randomUUID()},db);return {id:user.id,sessionHash:(await new SessionRepository(db).create(user.id)).session.token_hash};}
before(async()=>{await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);root=await actor();normal=await actor();folder=await mkdtemp(path.join(tmpdir(),'hormat-status-'));await writeFile(path.join(folder,'icon.png'),pixel);service=new OptionTypesService(new OptionTypesRepository('order-status',db),new MediaBrowser(folder));});
after(async()=>{await db.end();await pool.query(`DROP SCHEMA ${schema} CASCADE`);await pool.end();if(folder)await rm(folder,{recursive:true,force:true});});
test('Order Status schema, create/edit, base translations, Icon, search/sort and visibility',async()=>{
 const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='order_statuses' ORDER BY ordinal_position",[schema])).rows.map(r=>r.column_name);assert.deepEqual(columns,['id','name','description','icon_media_reference','sort_order','is_visible','is_default','created_by','updated_by','created_at','updated_at']);
 a=(await service.mutate(root,'create',undefined,{name:' First ',description:'Needle %',sort_order:10})).row.id;b=(await service.mutate(root,'create',undefined,{name:'Second',sort_order:0})).row.id;
 let row=(await service.detail(root,a)).row;assert.equal(row.basic.visible,false);assert.equal(row.basic.default,false);assert.equal(row.basic.name,'First');assert.equal(row.basic.icon,null);assert.deepEqual(row.translations,{name:{},description:{}});
 await service.mutate(root,'basic',a,{name:'Saved',description:'Persistent',icon_media_reference:'icon.png',is_visible:true});await service.mutate(root,'translations',a,{field:'name',translations:{ru:'Название'}});await service.mutate(root,'translations',a,{field:'description',translations:{ru:'Описание'}});await service.mutate(root,'translations',a,{field:'name',translations:{ru:' '}});
 row=(await service.detail(root,a)).row;assert.equal(row.basic.name,'Saved');assert.equal(row.translations.name.ru,undefined);assert.equal(row.translations.description.ru,'<p>Описание</p>');assert.equal(row.basic.icon?.path,'icon.png');assert.deepEqual((await service.list(root,{})).rows.map(r=>r.id),[b,a]);assert.equal((await service.list(root,{query:'persistent',visibility:'visible'})).rows[0].id,a);
 await service.mutate(root,'basic',a,{icon_media_reference:null});assert.deepEqual(await readFile(path.join(folder,'icon.png')),pixel);await assert.rejects(service.mutate(root,'basic',a,{icon_media_reference:'../escape'}),{code:'TYPE_INVALID_MEDIA'});await assert.rejects(service.mutate(root,'basic',a,{is_closed:true}),{code:'TYPE_INVALID'});
});
test('Order Status optional Default is atomic, visible, independent of sort; DB constraints and rollback',async()=>{
 await service.mutate(root,'basic',a,{is_default:true});await service.mutate(root,'basic',b,{is_default:true});assert.equal((await service.detail(root,a)).row.basic.default,false);assert.equal((await service.detail(root,b)).row.basic.visible,true);
 await service.mutate(root,'basic',a,{sort_order:-5});assert.equal((await service.list(root,{})).rows[0].id,a);assert.equal((await service.detail(root,b)).row.basic.default,true);
 await assert.rejects(service.mutate(root,'basic',b,{is_visible:false}),{code:'TYPE_DEFAULT_VISIBLE'});await assert.rejects(db.query('UPDATE order_statuses SET is_default=true WHERE id=$1',[a]),{code:'23505'});
 await db.query("CREATE FUNCTION reject_status() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.name='FAIL' THEN RAISE EXCEPTION 'fixture';END IF;RETURN NEW;END;$$;CREATE TRIGGER reject_status BEFORE UPDATE ON order_statuses FOR EACH ROW EXECUTE FUNCTION reject_status()");await assert.rejects(service.mutate(root,'basic',a,{name:'FAIL',is_default:true}),{code:'TYPE_SAVE_FAILED'});assert.equal((await service.detail(root,b)).row.basic.default,true);
 await service.mutate(root,'basic',b,{is_default:false});assert.equal((await db.query('SELECT * FROM order_statuses WHERE is_default')).rowCount,0);
});
test('Order Status independent permissions, Super User, and Media authorization',async()=>{
 const grant=async(key:string,value:unknown=true)=>{await db.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[normal.id]);await db.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)',[normal.id,key,JSON.stringify(value)]);};
 for(const action of ['view','create','update','visibility']){for(const value of [false,'true',1,null]){await grant('order_statuses.'+action,value);await assert.rejects(action==='view'?service.list(normal,{}):service.mutate(normal,action==='create'?'create':'basic',a,action==='visibility'?{is_visible:true}:{name:'Denied'}),{code:'TYPE_FORBIDDEN'});}await grant('order_statuses.'+action);if(action==='view'){await service.list(normal,{});await assert.rejects(service.mutate(normal,'basic',a,{name:'No'}),{code:'TYPE_FORBIDDEN'});}else if(action==='create')await service.mutate(normal,'create',undefined,{name:'Allowed'});else if(action==='update'){await service.mutate(normal,'basic',a,{is_default:true});await assert.rejects(service.mutate(normal,'basic',a,{is_visible:true}),{code:'TYPE_FORBIDDEN'});await assert.rejects(service.mutate(normal,'basic',a,{icon_media_reference:'icon.png'}),{code:'TYPE_FORBIDDEN'});await service.mutate(normal,'basic',a,{is_default:false});}else{await service.mutate(normal,'basic',a,{is_visible:false});await assert.rejects(service.mutate(normal,'basic',a,{is_default:true}),{code:'TYPE_FORBIDDEN'});}}
});
