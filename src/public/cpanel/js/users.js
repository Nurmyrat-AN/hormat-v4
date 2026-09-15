/* global bootstrap */
(() => {
 const root=document.getElementById('users-page');
 let users=JSON.parse(document.getElementById('users-data').textContent);
 const search=document.getElementById('users-search'),field=document.getElementById('users-field');
 const items=root.querySelector('.users-items'),results=document.getElementById('users-results'),loading=document.getElementById('users-loading');
 const statusFilter=document.getElementById('users-status-filter');
 const template=document.getElementById('users-item-template');
 const capabilities=JSON.parse(root.dataset.capabilities),feedback=document.getElementById('users-feedback');
 let page=1,total=Number(root.dataset.total),timer,selected=null,revision=0,requestController;
 const pageSize=9;
 const image=(img,url)=>{img.hidden=!url;if(url)img.src=url;else img.removeAttribute('src');img.onerror=()=>{img.hidden=true;};};
 const status=user=>user.active?root.dataset.active:root.dataset.inactive;
 const hasFilters=()=>!!search.value||field.value!=='name'||statusFilter.value!=='active';
 const allowed=(kind,user)=>kind==='add'?capabilities.create:!!user&&!user.protected&&capabilities[kind==='edit'?'update':kind]&&!(kind==='status'&&user.active&&user.id===root.dataset.actorId);
 function render(){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  items.replaceChildren();
  for(const user of users){
   const item=template.content.firstElementChild.cloneNode(true); item.dataset.userId=user.id;
   item.classList.toggle('is-inactive',!user.active);
   item.querySelector('[data-protected-label]').hidden=!user.protected;
   item.querySelector('[data-protected-info]').hidden=!user.protected;
   item.querySelectorAll('[data-user-action]').forEach(action=>{action.closest('li').hidden=!!user.protected;action.disabled=!allowed(action.dataset.userAction,user);if(action.dataset.userAction==='status'&&user.id===root.dataset.actorId&&!user.protected)action.title=root.dataset.selfDeactivate;});
   item.querySelector('[data-user-action="status"]').textContent=user.active?root.dataset.deactivate:root.dataset.activate;
   for(const key of ['name','email','phone','job','initials']) item.querySelector(`[data-${key}]`).textContent=user[key]||'—';
   const indicator=item.querySelector('[data-status]');indicator.textContent=status(user);indicator.classList.toggle('is-inactive',!user.active);
   image(item.querySelector('[data-avatar]'),user.avatarUrl);
   items.append(item);
  }
  const empty=document.getElementById('users-empty');empty.hidden=users.length!==0;
  empty.querySelector('[data-empty-users]').hidden=hasFilters();empty.querySelector('[data-empty-search]').hidden=!hasFilters();
  document.getElementById('users-pagination').hidden=pages<=1;
  document.getElementById('users-page-number').textContent=`${page} / ${pages}`;
  root.querySelector('[data-page="previous"]').disabled=page===1;root.querySelector('[data-page="next"]').disabled=page===pages;
  document.getElementById('users-clear').hidden=!hasFilters();
  results.setAttribute('aria-busy','false');loading.hidden=true;
 }
 async function load(sequence){
  const controller=new AbortController();requestController=controller;
  loading.hidden=false;results.setAttribute('aria-busy','true');
  try{
   const params=new URLSearchParams({query:search.value,field:field.value,status:statusFilter.value,page:String(page)});
   const response=await fetch(`/cpanel/api/users?${params}`,{signal:controller.signal,headers:{Accept:'application/json'}});
   if(sequence!==revision)return;
   if(response.redirected){location.assign('/cpanel/login');return;}
   const result=response.headers.get('content-type')?.includes('application/json')?await response.json():{message:await response.text()};
   if(sequence!==revision)return;
   if(!response.ok||!result.success)throw Object.assign(new Error(),{userMessage:result.message||root.dataset.failure});
   users=result.rows;total=result.total;page=result.page;render();
  }catch(error){if(sequence===revision&&error.name!=='AbortError'){feedback.textContent=error.userMessage||root.dataset.failure;feedback.hidden=false;}}
  finally{if(sequence===revision){loading.hidden=true;results.setAttribute('aria-busy','false');}}
 }
 function refresh(delay=0){clearTimeout(timer);requestController?.abort();const sequence=++revision;document.getElementById('users-clear').hidden=!hasFilters();timer=setTimeout(()=>void load(sequence),delay);}
 function filter(){page=1;feedback.hidden=true;refresh(300);}
 search.addEventListener('input',filter);field.addEventListener('change',filter);statusFilter.addEventListener('change',filter);
 document.getElementById('users-clear').addEventListener('click',()=>{search.value='';field.value='name';statusFilter.value='active';filter();search.focus();});
 function view(value){root.dataset.view=value==='list'?'list':'grid';root.querySelectorAll('[data-users-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.usersView===root.dataset.view)));}
 try{view(localStorage.getItem('hormat.cpanel.users.view'));}catch{view('grid');}
 root.querySelectorAll('[data-users-view]').forEach(button=>button.addEventListener('click',()=>{view(button.dataset.usersView);try{localStorage.setItem('hormat.cpanel.users.view',root.dataset.view);}catch{}}));
 root.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{page+=button.dataset.page==='next'?1:-1;refresh();}));
 items.addEventListener('click',event=>{
  const action=event.target.closest('[data-user-action]');if(!action)return;
  selected=users.find(user=>user.id===action.closest('[data-user-id]').dataset.userId);
  if(!allowed(action.dataset.userAction,selected))return;
  bootstrap.Modal.getOrCreateInstance(document.getElementById(`users-${action.dataset.userAction}`)).show(action);
 });
 for(const modal of root.querySelectorAll('.users-modal')){
  const form=modal.querySelector('form'),notice=modal.querySelector('[data-operation-notice]'),button=modal.querySelector('[data-operation-submit]');
  const uploader=modal.querySelector('[data-media-uploader]')?.mediaUploader;
  let generation=0,busy=false;
  modal.addEventListener('hide.bs.modal',event=>{if(busy)event.preventDefault();});
  function reset(){
   generation++;form.reset();notice.hidden=true;button.disabled=false;
   if(uploader){uploader.existingUrl=null;uploader.remove();uploader.element.querySelector('.shell-avatar > span').textContent='';}
   for(const toggle of modal.querySelectorAll('[data-password-toggle]'))if(toggle.getAttribute('aria-pressed')==='true')toggle.click();
  }
  button.disabled=false;
  modal.addEventListener('show.bs.modal',event=>{
   if(!allowed(modal.dataset.kind,selected)){event.preventDefault();return;}
   reset();if(modal.dataset.kind==='add')return;
   if(!selected)return;
   modal.querySelector('[data-selected-name]').textContent=selected.name;
   modal.querySelector('[data-selected-email]').textContent=selected.email;
   if(uploader){uploader.existingUrl=selected.avatarUrl;uploader.element.querySelector('.shell-avatar > span').textContent=selected.initials;uploader.render();}
   else {modal.querySelector('[data-selected-initials]').textContent=selected.initials;image(modal.querySelector('[data-selected-avatar]'),selected.avatarUrl);}
   for(const key of ['name','phone','job','email'])if(form.elements.namedItem(key))form.elements.namedItem(key).value=selected[key];
   if(modal.dataset.kind==='status'){
    modal.querySelector('[data-current-status]').textContent=status(selected);
    modal.querySelector('[data-new-status]').textContent=selected.active?root.dataset.inactive:root.dataset.active;
    button.textContent=selected.active?root.dataset.deactivate:root.dataset.activate;
   }
  });
  modal.addEventListener('hidden.bs.modal',reset);
  // Separate gate per dialog opening prevents a cancelled upload's old Save from affecting a reopened dialog.
  let save;
  modal.addEventListener('show.bs.modal',()=>{
   const current=generation;
   save=window.HormatMediaUploader.createSaveHandler(uploader?[uploader]:[],async tokens=>{
    if(current!==generation||!allowed(modal.dataset.kind,selected))return;
    notice.hidden=true;busy=true;
    const body=Object.fromEntries(new FormData(form));
    if(tokens[0])body.avatarCacheToken=tokens[0];
    const kind=modal.dataset.kind,target=selected?.id;
    if(kind==='status')body.status=selected.active?'inactive':'active';
    const url=kind==='add'?'/cpanel/api/users':`/cpanel/api/users/${target}${kind==='edit'?'':kind==='password'?'/password':'/status'}`;
    const controls=Array.from(modal.querySelectorAll('input,select,button'));const disabled=controls.map(control=>control.disabled);controls.forEach(control=>{control.disabled=true;});
    try{
     const response=await fetch(url,{method:kind==='edit'?'PATCH':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},body:JSON.stringify(body)});
     if(response.redirected){location.assign('/cpanel/login');return;}
     const result=response.headers.get('content-type')?.includes('application/json')?await response.json():{message:await response.text()};
     if(!response.ok||!result.success){
      notice.textContent=result.message||root.dataset.failure;notice.hidden=false;
      if(tokens[0]&&['avatarFailed','failure','duplicateEmail'].includes(result.code)){uploader.cacheToken=null;uploader.state='error';uploader.error='MEDIA_UPLOAD_FAILED';uploader.render();}
      return;
     }
     busy=false;bootstrap.Modal.getInstance(modal).hide();feedback.textContent=result.message;feedback.hidden=false;refresh();
    }catch{notice.textContent=root.dataset.failure;notice.hidden=false;}
    finally{busy=false;controls.forEach((control,index)=>{control.disabled=disabled[index];});for(const input of modal.querySelectorAll('[name=password],[name=confirm]'))input.value='';}
   },button);
  });
  form.addEventListener('submit',event=>{event.preventDefault();void save?.(event);});
 }
 render();
})();
