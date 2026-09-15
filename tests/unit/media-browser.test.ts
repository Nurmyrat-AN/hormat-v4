import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,chmod} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {MediaBrowser} from '../../src/cpanel/media/browser.js';
test('filesystem browser: real hierarchy, Unicode, search/sort, hidden/private files and traversal/symlink denial',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hormat-media-browser-')),browser=new MediaBrowser(root);
 try{
  await mkdir(path.join(root,'users'));await mkdir(path.join(root,'cache'));await mkdir(path.join(root,'cache','test'));await mkdir(path.join(root,'.incoming'));
  await writeFile(path.join(root,'users','Привет Türkmen.txt'),'hello');await writeFile(path.join(root,'cache','test','record.json'),'private');await writeFile(path.join(root,'cache','test','asset.bin'),'asset');await writeFile(path.join(root,'.DS_Store'),'hidden');await writeFile(path.join(root,'Thumbs.db'),'hidden');await symlink(os.tmpdir(),path.join(root,'escape'));await symlink(path.join(root,'users'),path.join(root,'internal'));
  assert.deepEqual((await browser.list('','','all','name')).items.map(e=>e.name),['cache','users']);
  const found=await browser.list('','türkmen','all','name');assert.equal(found.items.length,1);assert.equal(found.items[0].path,'users/Привет Türkmen.txt');assert.equal(found.items[0].url,null);assert.ok(!JSON.stringify(found).includes(root));
  assert.equal((await browser.list('','türkmen','current','name')).items.length,0);
  assert.deepEqual((await browser.list('cache/test','','all','name')).items.map(e=>e.name),['asset.bin']);
  for(const input of ['../','/tmp','users/../cache','users\\..','escape','internal','.incoming','users//bad','users/\0'])await assert.rejects(browser.list(input,'','all','name'));
  await assert.rejects(browser.entry('cache/test/record.json'));
  assert.equal((await browser.list('','record','all','name')).items.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('filesystem traversal returns explicit partial result bounds and respects cancellation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hormat-media-bounds-')),browser=new MediaBrowser(root);
 try{await Promise.all(Array.from({length:505},(_,i)=>writeFile(path.join(root,`file-${i}`),'')));const result=await browser.list('','','all','name');assert.equal(result.items.length,500);assert.equal(result.limited,true);const abort=new AbortController();abort.abort();assert.equal((await browser.list('','file','all','name',abort.signal)).items.length,0);}finally{await rm(root,{recursive:true,force:true});}
});

test('deep search is case insensitive; on-demand details use real metadata; refresh reflects external changes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hormat-media-deep-')),browser=new MediaBrowser(root);
 try{
  const deep='nested/level-one/level-two';await mkdir(path.join(root,deep),{recursive:true});await mkdir(path.join(root,'users/avatars'),{recursive:true});
  const name='aabbccdd-1234-4abc-8abc-123456789abc.png';
  await writeFile(path.join(root,'users/avatars',name),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64'));
  await writeFile(path.join(root,deep,'DEEP-ФАЙЛ.txt'),'deep');await writeFile(path.join(root,'Root.txt'),'root');await writeFile(path.join(root,'broken.png'),'not an image');
  assert.equal((await browser.list('','deep-файл','all','name')).items[0].parent,deep);
  assert.equal((await browser.list('','level-two','all','name')).items[0].folder,true);
  assert.equal((await browser.list('','root','all','name')).items[0].name,'Root.txt');
  assert.equal((await browser.list('nested','deep','current','name')).items.length,0);
  assert.equal((await browser.list('nested','LEVEL-ONE','current','name')).items[0].folder,true);
  const details=await browser.inspect('users/avatars/'+name);assert.equal(details.mimeType,'image/png');assert.equal(details.width,1);assert.equal(details.height,1);assert.equal(details.url,'/media/users/avatars/'+name);assert.equal(details.size,68);assert.ok(!JSON.stringify(details).includes(root));
  const token='12345678-1234-4123-8123-123456789abc';await mkdir(path.join(root,'cache',token),{recursive:true});await writeFile(path.join(root,'cache',token,'asset.bin'),'cached');await writeFile(path.join(root,'cache',token,'record.json'),JSON.stringify({ownerId:'private-owner',expiresAt:Date.now()+60000,extension:'bin',media:{cacheToken:token,mimeType:'image/png'}}));
  const cached=await browser.entry('cache/'+token+'/asset.bin');assert.equal(cached.type,'image');assert.equal(cached.url,'/media/cache/'+token+'.bin');assert.ok(!JSON.stringify(cached).includes('private-owner'));
  assert.equal((await browser.inspect('broken.png')).type,'file');assert.equal((await browser.inspect('nested')).childCount,1);
  await writeFile(path.join(root,'new.txt'),'new');assert.ok((await browser.list('','','all','name')).items.some(item=>item.name==='new.txt'));
  await rm(path.join(root,'new.txt'));assert.ok(!(await browser.list('','','all','name')).items.some(item=>item.name==='new.txt'));
  await rm(path.join(root,deep),{recursive:true});await assert.rejects(browser.inspect(deep));await assert.rejects(browser.inspect(''));
  for(const relative of ['../../','users/../../../','C:\\Windows','%2e%2e/','%252e%252e/'])await assert.rejects(browser.list(relative,'','all','name'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('inaccessible directory errors remain recoverable', {skip:process.getuid?.()===0},async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'hormat-media-access-')),target=path.join(root,'denied'),browser=new MediaBrowser(root);
 try{await mkdir(target);await chmod(target,0);await assert.rejects(browser.list('denied','','current','name'),{code:'EACCES'});await chmod(target,0o700);assert.deepEqual((await browser.list('denied','','current','name')).items,[]);}finally{await chmod(target,0o700);await rm(root,{recursive:true,force:true});}
});
