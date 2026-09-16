import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,readdir,rm,symlink,cp,rename} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {MediaManager} from '../../src/cpanel/media/mutations.js';
import {moveNoReplace} from '../../src/cpanel/media/move-filesystem.js';
async function fixture(run:(manager:MediaManager,root:string)=>Promise<void>){const root=await mkdtemp(path.join(os.tmpdir(),'hormat-move-'));try{await mkdir(path.join(root,'A/folder/child'),{recursive:true});await mkdir(path.join(root,'B'));await writeFile(path.join(root,'A/file.jpg'),'original');await writeFile(path.join(root,'A/folder/child/data'),'descendant');await run(new MediaManager(root),root);}finally{await rm(root,{recursive:true,force:true});}}
test('Move preserves names/descendants, changes URLs/search paths and browses real destination folders',()=>fixture(async(m,root)=>{
 const file=await m.moveItem('A/file.jpg','B');assert.equal(file.path,'B/file.jpg');assert.equal(file.url,'/media/B/file.jpg');assert.equal(await readFile(path.join(root,'B/file.jpg'),'utf8'),'original');await assert.rejects(lstat(path.join(root,'A/file.jpg')));
 await m.moveItem('A/folder','B');assert.equal(await readFile(path.join(root,'B/folder/child/data'),'utf8'),'descendant');await assert.rejects(lstat(path.join(root,'A/folder')));
 assert.deepEqual((await m.list('','file','all','name')).items.map(i=>i.path),['B/file.jpg']);
 assert.deepEqual((await m.destinationFolders('')).folders.map(i=>i.name),['A','B']);
 for(const folder of ['cache','users','products']){await m.createFolder('',folder);await m.moveItem('B/file.jpg',folder);await m.moveItem(folder,'A');await m.moveItem('A/'+folder+'/file.jpg','B');}
}));
test('Move rejects collision, same parent, self/descendant, root, unsafe paths, symlinks and private targets',()=>fixture(async(m,root)=>{
 await writeFile(path.join(root,'B/file.jpg'),'protected');await assert.rejects(m.moveItem('A/file.jpg','B'));assert.equal(await readFile(path.join(root,'B/file.jpg'),'utf8'),'protected');
 await mkdir(path.join(root,'B/folder'));await assert.rejects(m.moveItem('A/folder','B'));assert.deepEqual(await readdir(path.join(root,'B/folder')),[]);
 await assert.rejects(m.moveItem('A/file.jpg','A'),{code:'MEDIA_SAME_FOLDER'});
 for(const target of ['A/folder','A/folder/child'])await assert.rejects(m.moveItem('A/folder',target),{code:'MEDIA_MOVE_SELF'});
 await assert.rejects(m.moveItem('','B'),{code:'MEDIA_ROOT_PROTECTED'});
 for(const bad of ['../','/tmp','C:\\Windows','A/../B','%2e%2e','.manager-move']){await assert.rejects(m.moveItem('A/file.jpg',bad));await assert.rejects(m.moveItem(bad,'B'));}
 await symlink(os.tmpdir(),path.join(root,'escape'));await assert.rejects(m.moveItem('A/file.jpg','escape'));await assert.rejects(m.moveItem('escape','B'));
 await symlink(os.tmpdir(),path.join(root,'A/folder/link'));await assert.rejects(m.moveItem('A/folder',''));assert.equal(await readFile(path.join(root,'A/file.jpg'),'utf8'),'original');
}));
function exdev(){return Object.assign(new Error('cross-device'),{code:'EXDEV'});}
test('EXDEV copies/verifies/publishes files and directories before removing originals',()=>fixture(async(_m,root)=>{
 for(const name of ['file.jpg','folder']){
  let calls=0;await moveNoReplace(path.join(root,'A',name),path.join(root,'B',name),async()=>{}, {rename:async(a,b)=>{if(++calls===1)throw exdev();await rename(a,b);},copy:cp,remove:rm});
  await assert.rejects(lstat(path.join(root,'A',name)));assert.equal(await readFile(path.join(root,'B',name,name==='folder'?'child/data':''),'utf8'),name==='folder'?'descendant':'original');
 }
 assert.deepEqual((await readdir(path.join(root,'B'))).sort(),['file.jpg','folder']);
}));
test('EXDEV copy errors, verification mismatch, collision and revoked authority preserve originals and clean staging',()=>fixture(async(_m,root)=>{
 for(const scenario of ['copy','mismatch','collision','revoked']){
  let calls=0;await assert.rejects(moveNoReplace(path.join(root,'A/file.jpg'),path.join(root,'B/file.jpg'),async()=>{if(scenario==='revoked')throw new Error('denied');}, {
   rename:async(a,b)=>{if(++calls===1)throw exdev();if(scenario==='collision')throw Object.assign(new Error('collision'),{code:'EEXIST'});await rename(a,b);},
   copy:async(a,b,options)=>{await cp(a,b,options);if(scenario==='copy')throw new Error('disk full');if(scenario==='mismatch')await writeFile(String(b),'corrupt');},remove:rm
  }));assert.equal(await readFile(path.join(root,'A/file.jpg'),'utf8'),'original');assert.deepEqual(await readdir(path.join(root,'B')),[]);
 }
}));
test('source-removal failure retains verified destination and reports incomplete move',()=>fixture(async(_m,root)=>{
 let calls=0;await assert.rejects(moveNoReplace(path.join(root,'A/file.jpg'),path.join(root,'B/file.jpg'),async()=>{}, {rename:async(a,b)=>{if(++calls===1)throw exdev();await rename(a,b);},copy:cp,remove:async()=>{throw new Error('remove failure');}}),{code:'MEDIA_MOVE_INCOMPLETE'});
 assert.equal(await readFile(path.join(root,'A/file.jpg'),'utf8'),'original');assert.equal(await readFile(path.join(root,'B/file.jpg'),'utf8'),'original');assert.deepEqual(await readdir(path.join(root,'B')),['file.jpg']);
}));
