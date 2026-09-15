import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,readdir,rm,symlink} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {MediaManager} from '../../src/cpanel/media/mutations.js';
import {MediaStore} from '../../src/media/store.js';
async function fixture(run:(manager:MediaManager,root:string)=>Promise<void>){const root=await mkdtemp(path.join(os.tmpdir(),'hormat-manager-'));try{await run(new MediaManager(root),root);}finally{await rm(root,{recursive:true,force:true});}}
test('manager creates one Unicode child, renames file/folder without overwrite and preserves hierarchy',()=>fixture(async(manager,root)=>{
 await manager.createFolder('','Привет Türkmen');await manager.createFolder('Привет Türkmen','child');await writeFile(path.join(root,'Привет Türkmen/child/file.txt'),'original');
 await manager.renameItem('Привет Türkmen/child/file.txt','new.exe');assert.equal(await readFile(path.join(root,'Привет Türkmen/child/new.exe'),'utf8'),'original');
 await manager.renameItem('Привет Türkmen','renamed');assert.equal(await readFile(path.join(root,'renamed/child/new.exe'),'utf8'),'original');
 await assert.rejects(lstat(path.join(root,'Привет Türkmen')));await writeFile(path.join(root,'renamed/child/existing'),'protected');
 await assert.rejects(manager.renameItem('renamed/child/new.exe','existing'));assert.equal(await readFile(path.join(root,'renamed/child/existing'),'utf8'),'protected');
 await assert.rejects(manager.createFolder('renamed','child'));await manager.createFolder('','other');await assert.rejects(manager.renameItem('renamed','other'));assert.equal((await lstat(path.join(root,'other'))).isDirectory(),true);
 const results=await Promise.allSettled([manager.renameItem('renamed','race'),manager.renameItem('other','race')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await readdir(root)).length,2);
}));
test('manager rejects unsafe paths/names and root; stale paths fail; symlink escapes never followed',()=>fixture(async(manager,root)=>{
 await manager.createFolder('','safe');await writeFile(path.join(root,'safe/file'),'safe');await symlink(os.tmpdir(),path.join(root,'escape'));
 for(const value of ['../','../../','%2e%2e','%252e%252e','/tmp','C:\\Windows','safe/../','safe\\file','escape']){
  await assert.rejects(manager.createFolder(value,'child'));await assert.rejects(manager.renameItem(value,'new'));await assert.rejects(manager.deleteItem(value,true));
 }
 for(const name of ['.','..','../name','x/y','x\\y','/tmp','C:folder','%2e%2e','\0','.hidden','record.json/child']){await assert.rejects(manager.createFolder('',name));await assert.rejects(manager.renameItem('safe/file',name));}
 await assert.rejects(manager.renameItem('','new'),{code:'MEDIA_ROOT_PROTECTED'});await assert.rejects(manager.deleteItem('',true),{code:'MEDIA_ROOT_PROTECTED'});
 await assert.rejects(manager.renameItem('gone','new'));await assert.rejects(manager.deleteItem('gone',true));await assert.rejects(manager.createFolder('gone','new'));
 assert.equal(await readFile(path.join(root,'safe/file'),'utf8'),'safe');
}));
test('recursive deletion is explicit, includes hidden children, leaves siblings/outside intact and allows managed roots',()=>fixture(async(manager,root)=>{
 const outside=await mkdtemp(path.join(os.tmpdir(),'hormat-outside-'));
 try{
  await writeFile(path.join(outside,'safe'),'outside');await manager.createFolder('','target');await manager.createFolder('target','child');await writeFile(path.join(root,'target/child/b.jpg'),'b');await writeFile(path.join(root,'target/.hidden'),'a');await symlink(outside,path.join(root,'target/link'));
  await manager.createFolder('','sibling');await writeFile(path.join(root,'sibling/safe'),'sibling');assert.equal((await manager.deleteInfo('target')).nonEmpty,true);await assert.rejects(manager.deleteItem('target',false));await manager.deleteItem('target',true);assert.equal(await readFile(path.join(outside,'safe'),'utf8'),'outside');assert.equal(await readFile(path.join(root,'sibling/safe'),'utf8'),'sibling');
  for(const name of ['users','products','cache']){await manager.createFolder('',name);await manager.renameItem(name,name+'-renamed');await manager.deleteItem(name+'-renamed',false);}
  const store=new MediaStore(root,24);await store.initialize();await manager.deleteItem('cache',true);const stage=await store.staging();await writeFile(stage.file,'x');const ref=await store.publish(stage,'owner','x',{extension:'bin',mimeType:'application/octet-stream',size:1,width:null,height:null});assert.ok(ref.cacheToken);await assert.rejects(manager.createFolder('cache/'+ref.cacheToken,'fake'),{code:'MEDIA_CACHE_PROTECTED'});
  await assert.rejects(manager.renameItem('sibling/safe','../record.json'));
 }finally{await rm(outside,{recursive:true,force:true});}
}));
