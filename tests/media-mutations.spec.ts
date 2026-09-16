import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir,rm,symlink,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pool} from '../src/database/pool.js';
import {bootstrapSuperuser} from '../src/cpanel/auth/bootstrap.js';
import {sessions} from '../src/cpanel/auth/sessions.js';
import {MediaStore} from '../src/media/store.js';
import {booleanPermissionKeys} from '../src/cpanel/permissions/definitions.js';

test('Media mutation HTTP: independent strict permissions, CSRF, direct bytes, names, collisions, token security and revocation',async({context,page,baseURL,browser})=>{
 test.setTimeout(120000);const folder='mutation-'+randomUUID(),root=path.resolve('.test-media',folder),store=new MediaStore(path.resolve('.test-media'),24);let id='',superId='';
 try{
  await mkdir(root,{recursive:true});id=(await bootstrapSuperuser({name:'Media actor',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);
  const session=await sessions.create(id),cookie=(process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel')+'='+session.token,headers={Cookie:cookie,'X-CSRF-Token':session.session.csrf_token};
  const post=(operation:string,data:unknown,h=headers)=>context.request.post('/cpanel/api/media/'+operation,{headers:h,data});
  const upload=(name:string,buffer=Buffer.from('original'),parent=folder,h=headers)=>context.request.post('/cpanel/api/media/files?'+new URLSearchParams({path:parent}),{headers:h,multipart:{file:{name,mimeType:'application/octet-stream',buffer}}});
  const grant=async(key:string,value:unknown=true)=>pool.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3::jsonb) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value',[id,key,JSON.stringify(value)]);
  const bodies={folders:{parent:folder,name:'created'},rename:{path:folder+'/original.exe',name:'renamed.bin'},delete:{path:folder+'/original.exe',recursive:false}};
  await writeFile(path.join(root,'original.exe'),'old');
  for(const value of [undefined,false,null,'true','false',1,0,{},[]]){
   for(const key of ['media.view','media.upload','media.create_folder','media.rename','media.delete'])if(value===undefined)await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key=$2',[id,key]);else await grant(key,value);
   expect((await context.request.get('/cpanel/media',{headers})).status()).toBe(403);expect((await context.request.get('/cpanel/api/media/details?path='+folder+'/original.exe',{headers})).status()).toBe(403);
   expect((await upload('denied.bin')).status()).toBe(403);for(const [operation,data] of Object.entries(bodies))expect((await post(operation,data)).status()).toBe(403);
  }
  await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1',[id]);await grant('media.view');
  expect((await context.request.get('/cpanel/media',{headers})).status()).toBe(200);
  for(const [permission,operation] of [['media.upload','files'],['media.create_folder','folders'],['media.rename','rename'],['media.delete','delete']]){
   await grant(permission);
   for(const bad of [{Cookie:cookie},{Cookie:cookie,'X-CSRF-Token':'bad'}]){
    const result=operation==='files'?await upload('csrf.bin',Buffer.from('x'),folder,bad as typeof headers):await post(operation,bodies[operation as keyof typeof bodies],bad as typeof headers);expect(result.status()).toBe(403);
   }
   if(operation==='files'){
    const rootName='root-'+randomUUID()+'.bin';try{const created=await upload(rootName,Buffer.from('root'),'');expect(created.status()).toBe(201);expect((await context.request.get('/media/'+rootName)).status()).toBe(200);}finally{await rm(path.resolve('.test-media',rootName),{force:true});}
    for(const [name,bytes] of [['human.txt',Buffer.from('text')],['Привет Türkmen.exe',Buffer.from('MZ executable bytes')],['empty',Buffer.alloc(0)]] as const){const result=await upload(name,bytes);expect(result.status()).toBe(201);const data=await result.json();expect(data.cacheToken).toBeUndefined();expect(data.item.url).toBe('/media/'+folder+'/'+encodeURIComponent(name));const publicFile=await context.request.get(data.item.url);expect(publicFile.status()).toBe(200);expect(await publicFile.body()).toEqual(bytes);expect(publicFile.headers()['content-disposition']).toBe('attachment');expect(publicFile.headers()['x-content-type-options']).toBe('nosniff');}
    expect((await upload('human.txt')).status()).toBe(409);expect(await readFile(path.join(root,'human.txt'),'utf8')).toBe('text');
    expect((await upload('large',Buffer.alloc(10485761))).status()).toBe(413);expect((await upload('exact',Buffer.alloc(10485760))).status()).toBe(201);
    for(const name of ['../bad','bad/name','bad\\name','/tmp/bad','C:bad','.hidden','record.json','%2e%2e'])expect((await upload(name)).status()).toBe(400);
    for(const parent of ['../','%2e%2e','%252e%252e','/tmp','C:\\Windows',folder+'/../','missing-'+randomUUID()])expect([400,404]).toContain((await upload('bad',Buffer.from('x'),parent)).status());
    const domain=await context.request.post('/cpanel/media/upload',{headers,multipart:{file:{name:'domain.bin',mimeType:'application/octet-stream',buffer:Buffer.from('domain')}}});const domainMedia=(await domain.json()).media;
    try{expect((await upload(domainMedia.cacheToken+'.bin',Buffer.from('replacement'),'cache')).status()).toBe(409);expect(await (await context.request.get(domainMedia.url)).text()).toBe('domain');}finally{await rm(path.resolve('.test-media/cache',domainMedia.cacheToken),{recursive:true,force:true});}
    const token=randomUUID();const result=await upload(token+'.bin',Buffer.from('manual'),'cache');expect(result.status()).toBe(201);await expect(store.finalizeCachedMedia({cacheToken:token,destination:'users/avatars',ownerId:id})).rejects.toMatchObject({code:'MEDIA_CACHE_NOT_FOUND'});await rm(path.resolve('.test-media/cache',token+'.bin'));
   }else expect((await post(operation,bodies[operation as keyof typeof bodies])).status()).toBe(operation==='folders'?201:operation==='delete'?404:200);
   // A single grant never grants sibling operations.
   for(const other of ['files','folders','rename','delete'].filter(x=>x!==operation))expect((other==='files'?await upload('denied'):await post(other,bodies[other as keyof typeof bodies])).status()).toBe(403);
   await pool.query('DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key=$2',[id,permission]);
  }
  // Management integration: use the real Permissions Save endpoint to grant/revoke the logged-in actor.
  superId=(await bootstrapSuperuser({name:'Media manager',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const admin=await sessions.create(superId),adminHeaders={Cookie:cookie.split('=')[0]+'='+admin.token,'X-CSRF-Token':admin.session.csrf_token};
  const set=async(enabled:boolean)=>{const permissions=Object.fromEntries(booleanPermissionKeys.map(k=>[k,enabled&&k.startsWith('media.')]));expect((await context.request.post('/cpanel/api/permissions/'+id,{headers:adminHeaders,data:{permissions}})).status()).toBe(200);};
  await set(true);await pool.query("DELETE FROM cpanel_user_permissions WHERE user_id=$1 AND key='media.view'",[id]);expect((await post('folders',{parent:folder,name:'without-view'})).status()).toBe(201);expect((await context.request.get('/cpanel/api/media/delete-info?path='+folder,{headers})).status()).toBe(403);expect((await context.request.get('/cpanel/media',{headers})).status()).toBe(403);await set(true);await writeFile(path.join(root,'delete-me'),'x');expect((await post('delete',{path:folder+'/delete-me',recursive:false})).status()).toBe(200);await set(false);await writeFile(path.join(root,'keep-me'),'x');expect((await post('delete',{path:folder+'/keep-me',recursive:false})).status()).toBe(403);expect((await context.request.get('/cpanel/media',{headers})).status()).toBe(403);
  for(const [key,data] of Object.entries(bodies))expect((await post(key,{...data,path:'',parent:''},adminHeaders)).status()).not.toBe(200);
  expect((await post('rename',{path:'',name:'root'},adminHeaders)).status()).toBe(403);expect((await post('delete',{path:'',recursive:true},adminHeaders)).status()).toBe(403);
  expect((await pool.query('SELECT key,value FROM cpanel_user_permissions WHERE user_id=$1',[superId])).rows).toEqual([{key:'superuser',value:true}]);
  const anonymous=await browser.newContext({baseURL});try{for(const endpoint of ['files?path=','folders','rename','delete'])expect((await anonymous.request.post('/cpanel/api/media/'+endpoint,{maxRedirects:0,data:{}})).status()).toBe(303);}finally{await anonymous.close();}
 }finally{for(const user of [id,superId])if(user)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[user]);await rm(root,{recursive:true,force:true});}
});

test('Media filesystem HTTP: stale paths, symlinks, recursive contract and no reference repair',async({context,baseURL})=>{
 const folder='safety-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(path.join(root,'target/child'),{recursive:true});await mkdir(path.join(root,'sibling'));await writeFile(path.join(root,'target/child/a'),'a');await writeFile(path.join(root,'sibling/safe'),'safe');await symlink(path.join(root,'sibling'),path.join(root,'escape'));
  id=(await bootstrapSuperuser({name:'Safety',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(id),headers={Cookie:(process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel')+'='+session.token,'X-CSRF-Token':session.session.csrf_token};
  const post=(endpoint:string,data:unknown)=>context.request.post('/cpanel/api/media/'+endpoint,{headers,data});
  const info=await context.request.get('/cpanel/api/media/delete-info?path='+folder+'/target',{headers});expect((await info.json()).item.nonEmpty).toBe(true);
  for(const csrf of ['', 'bad'])expect((await context.request.post('/cpanel/api/media/delete',{headers:{...headers,'X-CSRF-Token':csrf},data:{path:folder+'/target',recursive:true}})).status()).toBe(403);
  expect((await post('delete',{path:folder+'/target',recursive:false})).status()).toBe(409);
  expect((await post('delete',{path:folder+'/target',recursive:'true'})).status()).toBe(400);
  expect((await post('delete',{path:folder+'/target',recursive:true})).status()).toBe(200);expect(await readFile(path.join(root,'sibling/safe'),'utf8')).toBe('safe');
  for(const bad of ['../','%2e%2e','/tmp','C:\\Windows',folder+'/../',folder+'/escape']){
   for(const [op,body] of [['folders',{parent:bad,name:'x'}],['rename',{path:bad,name:'x'}],['delete',{path:bad,recursive:true}]] as const)expect([400,404]).toContain((await post(op,body)).status());
   const uploaded=await context.request.post('/cpanel/api/media/files?'+new URLSearchParams({path:bad}),{headers,multipart:{file:{name:'x',mimeType:'text/plain',buffer:Buffer.from('x')}}});expect([400,404]).toContain(uploaded.status());
  }
  const avatar='/media/'+folder+'/sibling/safe';await pool.query('UPDATE cpanel_users SET avatar_url=$2 WHERE id=$1',[id,avatar]);
  expect((await post('rename',{path:folder+'/sibling/safe',name:'new.png'})).status()).toBe(200);expect((await context.request.get(avatar)).status()).toBe(404);expect((await context.request.get('/media/'+folder+'/sibling/new.png')).status()).toBe(200);expect((await post('delete',{path:folder+'/sibling/new.png',recursive:false})).status()).toBe(200);expect((await pool.query('SELECT avatar_url FROM cpanel_users WHERE id=$1',[id])).rows[0].avatar_url).toBe(avatar);
  expect((await post('rename',{path:folder+'/gone',name:'x'})).status()).toBe(404);expect((await post('delete',{path:folder+'/gone',recursive:true})).status()).toBe(404);
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});

test('Media real UI: per-file success/error, retry, search refresh, recursive confirmation and translated outcomes',async({page,context,baseURL})=>{
 test.setTimeout(90000);const folder='ui-'+randomUUID(),root=path.resolve('.test-media',folder);let id='';
 try{
  await mkdir(root,{recursive:true});id=(await bootstrapSuperuser({name:'Media UI',email:randomUUID()+'@example.invalid',password:randomUUID()})).id;const session=await sessions.create(id);
  await context.addCookies([{name:process.env.TEST_PRODUCTION==='1'?'__Secure-hormat_cpanel':'hormat_cpanel',value:session.token,domain:new URL(baseURL!).hostname,path:'/cpanel',secure:process.env.TEST_PRODUCTION==='1',httpOnly:true,sameSite:'Lax'}]);
  const rows=(await pool.query('SELECT * FROM interface_translations')).rows;
  for(const language of ['tm','ru','en']){
   const t=(key:string)=>rows.find(r=>r.language_code===language&&r.translation_key==='cpanel.media.'+key).translation_value;
   await context.addCookies([{name:'hormat_lang',value:language,url:baseURL!}]);await page.goto('/cpanel/media?'+new URLSearchParams({path:folder,query:'match-',scope:'current'}));
   await page.locator('[data-media-view=list]').click();
   await writeFile(path.join(root,'match-b.txt'),'existing');
   await page.locator('[data-media-action=upload]').click();await page.locator('#media-files').setInputFiles(['a','b','c'].map(name=>({name:'match-'+name+'.txt',mimeType:'text/plain',buffer:Buffer.from(name)})));await page.locator('#media-dialog-confirm').click();
   await expect(page.locator('#media-queue .text-success')).toHaveCount(2);await expect(page.locator('#media-queue .text-danger')).toHaveText(t('conflict'));expect(await readFile(path.join(root,'match-b.txt'),'utf8')).toBe('existing');
   // Retry only the failed row; successful independent siblings remain intact.
   await rm(path.join(root,'match-b.txt'));await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-queue .text-success')).toHaveCount(3);await expect(page.locator('#media-queue .text-success').first()).toHaveText(t('directUploaded'));await page.locator('#media-dialog .btn-close').click();await expect(page.locator('.media-item')).toHaveCount(3);
   await expect(page.locator('#media-manager')).toHaveAttribute('data-view','list');await expect(page.locator('[name=scope]')).toHaveValue('current');
   const a=page.locator('.media-item').filter({hasText:'match-a.txt'});await a.locator('[data-bs-toggle=dropdown]').click();await a.locator('[data-media-action=rename]').click();await page.locator('#media-name').fill('nonmatching.txt');await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toHaveText(t('renamed'));await expect(page.locator('.media-item')).toHaveCount(2);
   await page.locator('[data-media-action=new]').click();await page.locator('#media-name').fill('match-folder');await page.route('**/cpanel/api/media/folders',route=>route.abort('failed'));await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-dialog-feedback')).toHaveText(t('failed'));await expect(page.locator('#media-name')).toHaveValue('match-folder');await page.unroute('**/cpanel/api/media/folders');await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toHaveText(t('created'));await expect(page.locator('.media-item')).toHaveCount(3);
   await writeFile(path.join(root,'match-folder/child'),'child');const target=page.locator('.media-item').filter({hasText:'match-folder'});await target.locator('[data-bs-toggle=dropdown]').click();await target.locator('[data-media-action=delete]').click();await expect(page.locator('#media-recursive')).toBeVisible();await expect(page.locator('#media-risk')).toBeVisible();await expect(page.locator('#media-dialog-confirm')).toBeDisabled();await expect(page.locator('#media-recursive')).toContainText(t('nonEmpty'));
   for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.bsTheme=theme,theme);for(const width of [1440,375]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:`artifacts/media-activation-${language}-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}}
   await page.setViewportSize({width:1440,height:900});await page.locator('#media-recursive-confirm').check();await page.locator('#media-dialog-confirm').click();await expect(page.locator('#media-feedback')).toHaveText(t('deleted'));await expect(page.locator('.media-item')).toHaveCount(2);
   for(const entry of await readdir(root))await rm(path.join(root,entry),{recursive:true,force:true});
  }
 }finally{if(id)await pool.query('DELETE FROM cpanel_users WHERE id=$1',[id]);await rm(root,{recursive:true,force:true});}
});
