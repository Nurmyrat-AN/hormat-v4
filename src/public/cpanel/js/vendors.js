(() => {
 const root=document.querySelector('#vendors-page');if(!root)return;
 let rows=JSON.parse(document.querySelector('#vendors-data').textContent),total=Number(root.dataset.total),page=1,revision=0,searchRequest,detailRequest,timer,selected,action='',busy=false,modalReady=false,closing=false;
 const capabilities=JSON.parse(root.dataset.capabilities),items=document.querySelector('#vendors-items'),template=document.querySelector('#vendor-template');
 const query=document.querySelector('#vendors-search'),field=document.querySelector('#vendors-field'),status=document.querySelector('#vendors-status');
 const dialog=document.querySelector('#vendor-dialog'),modal=bootstrap.Modal.getOrCreateInstance(dialog),save=document.querySelector('#vendor-save'),notice=document.querySelector('#vendor-notice'),feedback=document.querySelector('#vendors-feedback');
 const messages=Object.fromEntries(Array.from(document.querySelectorAll('[data-vendor-message]'),el=>[el.dataset.vendorMessage,el.textContent]));
 const statusText=row=>row.active?root.dataset.active:root.dataset.inactive,configured=row=>row.passwordConfigured?root.dataset.configured:root.dataset.notConfigured;
 const failure=(error)=>messages[error.code]||(error.status===403?messages.VENDOR_FORBIDDEN:messages.VENDOR_READ_FAILED);
 async function api(url,options={}){const response=await fetch(url,options);const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw Object.assign(new Error(),{code:data.code,status:response.status});return data;}
 function render(){
  items.replaceChildren();for(const row of rows){const item=template.content.firstElementChild.cloneNode(true);item.dataset.vendorId=row.id;item.classList.toggle('is-inactive',!row.active);
   item.querySelectorAll('[data-value]').forEach(el=>{const key=el.dataset.value;el.textContent=key==='status'?statusText(row):row[key];if(['url','lastSequence'].includes(key))el.title=row[key];});item.querySelector('[data-health]').dataset.health=row.health;items.append(item);
  }
  document.querySelector('#vendors-empty').hidden=rows.length>0;
  document.querySelector('#vendors-pagination').hidden=total<=9;document.querySelector('#vendors-page-number').textContent=page+' / '+Math.max(1,Math.ceil(total/9));
  root.querySelector('[data-vendor-page=previous]').disabled=page===1;root.querySelector('[data-vendor-page=next]').disabled=page>=Math.ceil(total/9);
 }
 async function search(){clearTimeout(timer);searchRequest?.abort();searchRequest=new AbortController();const current=++revision;items.setAttribute('aria-busy','true');
  try{const data=await api('/cpanel/api/vendors?'+new URLSearchParams({query:query.value,field:field.value,status:status.value,page:String(page)}),{signal:searchRequest.signal});if(current!==revision)return false;rows=data.rows;total=data.total;page=data.page;render();feedback.textContent='';return true;}
  catch(error){if(error.name!=='AbortError'&&current===revision)feedback.textContent=failure(error);return false;}
  finally{if(current===revision)items.removeAttribute('aria-busy');}
 }
 query.addEventListener('input',()=>{page=1;clearTimeout(timer);searchRequest?.abort();++revision;timer=setTimeout(search,300);});
 [field,status].forEach(select=>select.addEventListener('change',()=>{page=1;search();}));
 root.querySelectorAll('[data-vendor-page]').forEach(button=>button.addEventListener('click',()=>{page+=button.dataset.vendorPage==='next'?1:-1;search();}));
 function view(value){root.dataset.view=value;root.querySelectorAll('[data-vendors-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.vendorsView===value)));try{localStorage.setItem('hormat.cpanel.vendors.view',value);}catch{}}
 let initial='grid';try{if(localStorage.getItem('hormat.cpanel.vendors.view')==='list')initial='list';}catch{}view(initial);
 root.querySelectorAll('[data-vendors-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.vendorsView)));
 const password=document.querySelector('#vendor-password'),toggle=dialog.querySelector('[data-password-toggle]');
 function clearPassword(){password.value='';if(password.type!=='password')toggle.click();}
 function populate(kind,row){
  dialog.querySelectorAll('[data-vendor-section]').forEach(part=>part.hidden=part.dataset.vendorSection!==(['add','edit'].includes(kind)?'editor':kind));
  document.querySelector('#vendor-dialog-title').textContent=kind==='status'?(row.active?root.dataset.deactivate:root.dataset.activate):root.dataset[kind];
  document.querySelector('#vendor-initial-status').hidden=kind!=='add';document.querySelector('#vendor-password-help').hidden=kind!=='edit';
  const state=document.querySelector('#vendor-password-state');state.hidden=kind!=='edit';state.textContent=row?configured(row):'';
  if(kind==='edit')dialog.querySelectorAll('[data-field]').forEach(input=>input.value=row[input.dataset.field]);
  if(kind==='details')dialog.querySelectorAll('[data-detail]').forEach(el=>{const key=el.dataset.detail;el.textContent=key==='status'?statusText(row):key==='passwordConfigured'?configured(row):row[key];});
  if(kind==='status'){document.querySelector('#vendor-status-name').textContent=row.name;document.querySelector('#vendor-current-status').textContent=statusText(row);document.querySelector('#vendor-next-status').textContent=row.active?root.dataset.inactive:root.dataset.active;}
  if(kind==='reset')document.querySelector('#vendor-reset-name').textContent=row.name;
  const cancel=document.querySelector('#vendor-cancel');cancel.textContent=kind==='reset'?cancel.dataset.cancel:cancel.dataset.close;
  save.classList.toggle('btn-danger',kind==='reset');save.classList.toggle('btn-success',kind!=='reset');
  save.hidden=kind==='details';save.disabled=kind==='details';save.textContent=kind==='reset'?root.dataset.resetAction:kind==='add'?root.dataset.add:kind==='status'?(row.active?root.dataset.deactivate:root.dataset.activate):root.dataset.save;
 }
 root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-vendor-action]');if(!button||busy)return;
  if(closing)await new Promise(resolve=>dialog.addEventListener('hidden.bs.modal',resolve,{once:true}));
  const kind=button.dataset.vendorAction,row=rows.find(item=>item.id===button.closest('[data-vendor-id]')?.dataset.vendorId);
  if(kind!=='details'&&!capabilities[kind==='add'?'create':kind==='edit'?'update':kind==='reset'?'reset_sync':'status'])return;if(kind!=='add'&&!row)return;
  action=kind;selected=null;notice.hidden=true;document.querySelector('#vendor-form').reset();clearPassword();
  detailRequest?.abort();detailRequest=new AbortController();const active=detailRequest;
  if(kind==='add'){populate(kind,null);modal.show();return;}
  dialog.querySelectorAll('[data-vendor-section]').forEach(part=>part.hidden=true);save.disabled=true;save.hidden=true;document.querySelector('#vendor-dialog-title').textContent=root.dataset.working;modal.show();
  try{const data=await api('/cpanel/api/vendors/'+row.id,{signal:active.signal});if(active!==detailRequest)return;selected=data.row;populate(kind,selected);}
  catch(error){if(error.name!=='AbortError'&&active===detailRequest){notice.textContent=failure(error);notice.hidden=false;}}
 });
 function setBusy(value){busy=value;save.disabled=value;dialog.querySelectorAll('input,select,[data-bs-dismiss]').forEach(el=>el.disabled=value);if(value)save.textContent=root.dataset.working;}
 async function submit(){
  if(busy||save.hidden||save.disabled)return;
  const payload=action==='reset'?{}:action==='status'?{status:selected.active?'inactive':'active'}:Object.fromEntries(Array.from(dialog.querySelectorAll('[data-field]'),input=>[input.dataset.field,input.value]));
  if(action!=='status'&&action!=='reset')payload.password=password.value;if(action==='add')payload.status=document.querySelector('#vendor-active').value;
  const endpoint='/cpanel/api/vendors'+(action==='add'?'':'/'+selected.id)+(action==='reset'?'/reset-sync':action==='status'?'/status':'');const original=save.textContent;setBusy(true);notice.hidden=true;
  try{const data=await api(endpoint,{method:action==='edit'?'PATCH':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},body:JSON.stringify(payload)});clearPassword();const refreshed=await search();setBusy(false);if(modalReady)modal.hide();else dialog.addEventListener('shown.bs.modal',()=>modal.hide(),{once:true});feedback.textContent=messages[data.code]+(refreshed?'':' '+messages.VENDOR_READ_FAILED);}
  catch(error){setBusy(false);save.textContent=original;clearPassword();notice.textContent=failure(error);notice.hidden=false;if(error.status===403||error.status===404)save.disabled=true;}
 }
 save.addEventListener('click',submit);document.querySelector('#vendor-form').addEventListener('submit',event=>{event.preventDefault();submit();});
 dialog.addEventListener('show.bs.modal',()=>modalReady=false);dialog.addEventListener('shown.bs.modal',()=>modalReady=true);
 dialog.addEventListener('hide.bs.modal',event=>{if(busy)event.preventDefault();else{closing=true;detailRequest?.abort();detailRequest=null;}});
 dialog.addEventListener('hidden.bs.modal',()=>{closing=false;clearPassword();document.querySelector('#vendor-form').reset();notice.hidden=true;selected=null;});
 render();
})();
