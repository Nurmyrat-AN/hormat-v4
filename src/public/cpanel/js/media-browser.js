(() => {
 const root=document.querySelector('#media-manager');if(!root)return;
 const form=document.querySelector('#media-search-form'),results=document.querySelector('#media-results'),feedback=document.querySelector('#media-feedback'),loading=document.querySelector('#media-loading');
 const dialog=document.querySelector('#media-dialog'),modal=bootstrap.Modal.getOrCreateInstance(dialog),labels=document.querySelector('#media-action-labels').dataset;
 let request,detailRequest,sequence=0,timer,action='',selected=null,busy=false,deleteReady=false;
 const mutationLabels=document.querySelector('#media-mutation-labels').dataset,confirm=document.querySelector('#media-dialog-confirm');
 const errors=Object.fromEntries(Array.from(document.querySelectorAll('[data-error-code]'),el=>[el.dataset.errorCode,el.textContent]));
 const errorText=(code,status)=>errors[code]||(status===403?errors.MEDIA_PERMISSION_DENIED:root.dataset.failed);
 const initialSelection=root.querySelector('.media-item.is-selected');if(initialSelection)selected=JSON.parse(initialSelection.dataset.entry);
 const message=text=>{feedback.textContent=text;feedback.hidden=false;const local=document.querySelector('#media-dialog-feedback');local.textContent=text;local.hidden=!dialog.classList.contains('show');};
 function view(value){root.dataset.view=value;document.querySelectorAll('[data-media-view]').forEach(b=>{b.classList.toggle('active',b.dataset.mediaView===value);b.setAttribute('aria-pressed',String(b.dataset.mediaView===value));});try{localStorage.setItem('hormat.cpanel.media.view',value);}catch{}}
 let initial='grid';try{if(localStorage.getItem('hormat.cpanel.media.view')==='list')initial='list';}catch{}view(initial);
 root.querySelectorAll('[data-media-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.mediaView)));
 async function search(){
  clearTimeout(timer);request?.abort();request=new AbortController();const current=++sequence;loading.hidden=false;feedback.hidden=true;results.setAttribute('aria-busy','true');
  const params=new URLSearchParams(new FormData(form));params.set('partial','1');
  try{const response=await fetch('/cpanel/media?'+params,{signal:request.signal,headers:{Accept:'text/html'}});if(response.redirected)throw new Error();const html=await response.text();if(!response.ok){if(current===sequence&&response.status===404){results.innerHTML=html;return;}throw new Error();}if(current!==sequence)return;results.innerHTML=html;selected=null;params.delete('partial');history.replaceState(null,'','/cpanel/media?'+params);}
  catch(error){if(error.name!=='AbortError'&&current===sequence)message(root.dataset.failed);}
  finally{if(current===sequence){loading.hidden=true;results.removeAttribute('aria-busy');}}
 }
 document.querySelector('#media-refresh').addEventListener('click',search);
 form.addEventListener('submit',event=>{event.preventDefault();search();});
 form.querySelector('[name=query]').addEventListener('input',()=>{clearTimeout(timer);request?.abort();++sequence;timer=setTimeout(search,300);});
 form.querySelector('[name=scope]').addEventListener('change',search);document.querySelector('[name=sort]').addEventListener('change',search);
 async function copy(url){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(url);else{const input=document.createElement('textarea');input.value=url;document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw new Error();}message(root.dataset.copied);}catch{message(root.dataset.copyFailed);}}
 document.addEventListener('click',event=>{
  if(busy||(!root.contains(event.target)&&!dialog.contains(event.target)))return;
  const item=event.target.closest('.media-item');if(item){root.querySelector('.media-item.is-selected')?.classList.remove('is-selected');item.classList.add('is-selected');selected=JSON.parse(item.dataset.entry);}
  const button=event.target.closest('[data-media-action]');if(!button||button.disabled)return;
  detailRequest?.abort();document.querySelector('#media-dialog-feedback').hidden=true;
  action=button.dataset.mediaAction;if(action==='copy'){if(selected?.url)copy(selected.url);return;}
  document.querySelector('#media-dialog-title').textContent=labels[action];
  document.querySelector('#media-dialog-item').textContent=['rename','delete','details'].includes(action)?selected?.name??'':'';
  dialog.querySelectorAll('[data-dialog-part]').forEach(part=>{part.hidden=part.dataset.dialogPart!==(action==='rename'||action==='new'?'name':action);});
  document.querySelector('#media-name').value=action==='rename'?selected.name:'';
  document.querySelector('#media-name-error').hidden=true;
  document.querySelector('#media-extension').hidden=action!=='rename'||selected.folder;
  document.querySelector('#media-folder-warning').hidden=!selected?.folder;
  document.querySelector('#media-risk').hidden=!selected?.managed;
  confirm.disabled=false;confirm.textContent=mutationLabels.confirm;deleteReady=false;document.querySelector('#media-recursive').hidden=true;document.querySelector('#media-recursive-confirm').checked=false;
  if(action==='delete'){confirm.disabled=true;loadDeleteInfo(selected.path);}
  document.querySelector('#media-cache-warning').hidden=!(['upload','new'].includes(action)?form.elements.path.value.split('/')[0]==='cache':selected?.temporary);
  document.querySelector('#media-detail-preview').hidden=true;document.querySelector('#media-detail-loading').hidden=action!=='details';
  document.querySelector('#media-dialog-confirm').hidden=action==='details';
  document.querySelector('#media-dialog-confirm').className='btn '+(action==='delete'?'btn-danger':'btn-success');
  if(action==='details'){
   const values={type:selected.typeLabel,path:selected.path,size:selected.sizeLabel,modified:selected.modifiedLabel,mime:'—',dimensions:'—',children:'—'};
   dialog.querySelectorAll('[data-detail]').forEach(el=>el.textContent=values[el.dataset.detail]);
   setUrl(selected.url);loadDetails(selected.path);
  }
  modal.show();
 });
 function setUrl(url){document.querySelector('#media-public-url').value=url??'';document.querySelector('#media-public-url').hidden=!url;document.querySelector('#media-no-url').hidden=!!url;dialog.querySelector('[data-media-action=copy]').disabled=!url;}
 async function loadDetails(location){
  detailRequest=new AbortController();const active=detailRequest;
  try{
   const response=await fetch('/cpanel/api/media/details?'+new URLSearchParams({path:location}),{signal:active.signal});if(response.redirected||!response.ok)throw new Error();const {item}=await response.json();
   if(active!==detailRequest||action!=='details')return;selected={...selected,...item};setUrl(item.url);
   dialog.querySelector('[data-detail=type]').textContent=labels[item.type];dialog.querySelector('[data-detail=mime]').textContent=item.mimeType??'—';dialog.querySelector('[data-detail=dimensions]').textContent=item.width&&item.height?item.width+' × '+item.height:'—';dialog.querySelector('[data-detail=children]').textContent=item.childCount===null?'—':item.childCount+(item.childCountLimited?'+':'');
   const preview=document.querySelector('#media-detail-preview');if(item.image&&item.url){preview.src=item.url;preview.hidden=false;}
  }catch(error){if(error.name!=='AbortError'&&active===detailRequest){setUrl(null);message(root.dataset.failed);}}
  finally{if(active===detailRequest)document.querySelector('#media-detail-loading').hidden=true;}
 }
 document.querySelector('#media-detail-preview').addEventListener('error',event=>event.target.hidden=true);
 root.addEventListener('keydown' ,event=>{if(event.target.matches('.media-item')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.querySelector('.media-name').click();}});
 async function loadDeleteInfo(location){
  detailRequest=new AbortController();const active=detailRequest;
  try{const response=await fetch('/cpanel/api/media/delete-info?'+new URLSearchParams({path:location}),{signal:active.signal});const data=await response.json();if(!response.ok||!data.success)throw new Error(errorText(data.error?.code,response.status));
   if(active!==detailRequest||action!=='delete')return;
   selected={...selected,...data.item};document.querySelector('#media-recursive').hidden=!selected.nonEmpty;deleteReady=true;confirm.disabled=selected.nonEmpty;
  }catch(error){if(error.name!=='AbortError'&&active===detailRequest)message(error.message||root.dataset.failed);}
 }
 document.querySelector('#media-recursive-confirm').addEventListener('change',event=>{confirm.disabled=busy||!deleteReady||(selected?.nonEmpty&&!event.target.checked);});
 function setBusy(value){busy=value;confirm.disabled=value;confirm.textContent=value?mutationLabels.working:mutationLabels.confirm;dialog.querySelectorAll('[data-bs-dismiss],#media-files,#media-name').forEach(el=>el.disabled=value);}
 dialog.addEventListener('hide.bs.modal',event=>{if(busy)event.preventDefault();});
 document.querySelector('#media-dialog-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(['rename','new'].includes(action)&&!document.querySelector('#media-name').value.trim()){document.querySelector('#media-name-error').hidden=false;return;}
  if(action==='delete'&&(!deleteReady||(selected.nonEmpty&&!document.querySelector('#media-recursive-confirm').checked)))return;
  if(action==='upload'){
   if(!uploads.length){document.querySelector('#media-queue-error').textContent=root.dataset.required;document.querySelector('#media-queue-error').hidden=false;return;}
   setBusy(true);const location=form.elements.path.value;let changed=false;
   for(const entry of uploads){if(entry.done)continue;entry.state.className='';entry.state.textContent=mutationLabels.working;
    try{await sendFile(entry,location);entry.done=true;changed=true;entry.state.textContent=mutationLabels.uploaded;entry.state.className='text-success';}
    catch(error){entry.state.textContent=error.message;entry.state.className='text-danger';}
   }
   if(changed)await search();setBusy(false);return;
  }
  const operation=action==='new'?'folders':action;
  const payload=action==='new'?{parent:form.elements.path.value,name:document.querySelector('#media-name').value}:action==='rename'?{path:selected.path,name:document.querySelector('#media-name').value}:{path:selected.path,recursive:document.querySelector('#media-recursive-confirm').checked};
  setBusy(true);
  try{
   const response=await fetch('/cpanel/api/media/'+operation,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw Object.assign(new Error(errorText(data.error?.code,response.status)),{code:data.error?.code});
   const text=mutationLabels[action==='new'?'created':action==='rename'?'renamed':'deleted'];await search();setBusy(false);modal.hide();message(text);
  }catch(error){setBusy(false);message(error.message||root.dataset.failed);if(error.code==='MEDIA_FOLDER_NOT_EMPTY')loadDeleteInfo(selected.path);}
 });
 const queue=document.querySelector('#media-queue');let uploads=[];
 function files(values){if(busy)return;document.querySelector('#media-queue-error').hidden=true;queue.replaceChildren();uploads=[];for(const file of Array.from(values).slice(0,100)){const row=document.createElement('div');row.className='media-queue-row';const name=document.createElement('strong');name.textContent=file.name;const state=document.createElement('small');state.textContent=root.dataset.queued;const progress=document.createElement('progress');progress.max=100;progress.value=0;progress.setAttribute('aria-label',file.name);row.append(name,state,progress);queue.append(row);uploads.push({file,state,progress,done:false});}}
 function sendFile(entry,location){return new Promise((resolve,reject)=>{
  if(entry.file.size>10485760){reject(new Error(errors.MEDIA_FILE_TOO_LARGE));return;}
  const xhr=new XMLHttpRequest();xhr.open('POST','/cpanel/api/media/files?'+new URLSearchParams({path:location}));xhr.setRequestHeader('X-CSRF-Token',root.dataset.csrf);xhr.timeout=300000;
  entry.progress.removeAttribute('value');xhr.upload.onprogress=event=>{if(event.lengthComputable)entry.progress.value=Math.round(event.loaded/event.total*100);};
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{}if(xhr.status===201&&data?.success)resolve();else reject(new Error(errorText(data?.error?.code,xhr.status)));};
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(new Error(root.dataset.failed));const body=new FormData();body.append('file',entry.file);xhr.send(body);
 });}
 document.querySelector('#media-files').addEventListener('change',event=>files(event.target.files));
 const drop=document.querySelector('#media-drop');drop.addEventListener('dragover',event=>event.preventDefault());drop.addEventListener('drop',event=>{event.preventDefault();files(event.dataTransfer.files);});
 dialog.addEventListener('hidden.bs.modal',()=>{detailRequest?.abort();uploads=[];queue.replaceChildren();document.querySelector('#media-queue-error').hidden=true;document.querySelector('#media-files').value='';});
 results.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.hidden=true;},true);
})();
