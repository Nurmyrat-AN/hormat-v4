(() => {
 const root=document.querySelector('#media-manager');if(!root)return;
 const form=document.querySelector('#media-search-form'),results=document.querySelector('#media-results'),feedback=document.querySelector('#media-feedback'),loading=document.querySelector('#media-loading');
 const dialog=document.querySelector('#media-dialog'),modal=bootstrap.Modal.getOrCreateInstance(dialog),labels=document.querySelector('#media-action-labels').dataset;
 let request,detailRequest,sequence=0,timer,action='',selected=null;
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
  if(!root.contains(event.target)&&!dialog.contains(event.target))return;
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
  document.querySelector('#media-mock-notice').hidden=action==='details';
  document.querySelector('#media-cache-warning').hidden=!selected?.temporary;
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
 document.querySelector('#media-dialog-form').addEventListener('submit',event=>{event.preventDefault();if(['rename','new'].includes(action)&&!document.querySelector('#media-name').value.trim()){document.querySelector('#media-name-error').hidden=false;return;}if(action==='upload'){const error=document.querySelector('#media-queue-error');if(!queue.children.length){error.textContent=root.dataset.required;error.hidden=false;return;}error.hidden=true;queue.querySelectorAll('progress').forEach(progress=>progress.value=100);queue.querySelectorAll('small').forEach(state=>{state.textContent=root.dataset.preview;state.classList.add('text-success');});return;}message(root.dataset.preview);modal.hide();});
 const queue=document.querySelector('#media-queue');
 function files(values){document.querySelector('#media-queue-error').hidden=true;queue.replaceChildren();for(const file of Array.from(values).slice(0,100)){const row=document.createElement('div');row.className='media-queue-row';const name=document.createElement('strong');name.textContent=file.name;const state=document.createElement('small');state.textContent=root.dataset.queued;const progress=document.createElement('progress');progress.max=100;progress.value=0;progress.setAttribute('aria-label',file.name);row.append(name,state,progress);queue.append(row);}}
 document.querySelector('#media-files').addEventListener('change',event=>files(event.target.files));
 const drop=document.querySelector('#media-drop');drop.addEventListener('dragover',event=>event.preventDefault());drop.addEventListener('drop',event=>{event.preventDefault();files(event.dataTransfer.files);});
 dialog.addEventListener('hidden.bs.modal',()=>{detailRequest?.abort();queue.replaceChildren();document.querySelector('#media-queue-error').hidden=true;document.querySelector('#media-files').value='';});
 results.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.hidden=true;},true);
})();
