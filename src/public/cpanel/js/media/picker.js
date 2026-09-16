import {mediaPreview} from './preview.js';
/** Selection adapter over the existing File Manager reads and direct-upload API. */
export class MediaPicker {
 constructor(root,dialog){
  this.root=root;this.dialog=dialog;this.items=[];this.active=false;this.busy=false;this.sequence=0;
  this.labels=Object.fromEntries([...root.querySelectorAll('[data-picker-label]')].map(el=>[el.dataset.pickerLabel,el.textContent]));
  this.find=selector=>root.querySelector(selector);this.search=this.find('[data-picker-search]');this.scope=this.find('[data-picker-scope]');this.notice=this.find('[data-picker-notice]');
  root.querySelectorAll('[data-picker-cancel]').forEach(button=>button.addEventListener('click',()=>this.close()));
  this.find('[data-picker-confirm]').addEventListener('click',()=>this.confirm());
  this.find('[data-picker-refresh]').addEventListener('click',()=>this.load());
  this.search.addEventListener('input',()=>{clearTimeout(this.timer);this.request?.abort();++this.sequence;this.timer=setTimeout(()=>this.load(),300);});this.scope.addEventListener('change',()=>this.load());
  root.querySelectorAll('[data-picker-view]').forEach(button=>button.addEventListener('click',()=>this.view(button.dataset.pickerView)));
  this.find('[data-picker-upload]')?.addEventListener('click',()=>{if(!this.busy)this.find('[data-picker-files]').click();});
  this.find('[data-picker-files]')?.addEventListener('change',event=>this.upload([...event.target.files]));
  // Retain the existing Bootstrap focus trap/backdrop; dismiss the selection layer first.
  dialog.addEventListener('hide.bs.modal',event=>{if(this.active){event.preventDefault();event.stopImmediatePropagation();this.close();}},{capture:true});
 }
 open({mode='single',mediaType='all',permanentOnly=false,initialSelection=[],exclude=[],onSelect,trigger}){
  this.mode=mode;this.mediaType=mediaType;this.permanentOnly=permanentOnly;this.find('[data-picker-permanent-only]').hidden=!permanentOnly;this.find('[data-picker-image-only]').hidden=mediaType!=='image';this.exclude=new Set(exclude);this.onSelect=onSelect;this.trigger=trigger;this.chosen=new Map(initialSelection.filter(item=>this.eligible(item)&&!this.exclude.has(item.path)).slice(0,mode==='single'?1:200).map(item=>[item.path,item]));this.path='';this.search.value='';this.scope.value='all';this.active=true;this.busy=false;
  this.originalTitle=this.dialog.getAttribute('aria-labelledby');this.dialog.setAttribute('aria-labelledby','media-picker-title');
  this.siblings=[...this.root.parentElement.children].filter(el=>el!==this.root).map(el=>({el,inert:el.inert}));this.siblings.forEach(({el})=>el.inert=true);
  this.root.parentElement.classList.add('media-picker-open');this.root.hidden=false;this.root.dataset.mode=mode;this.view('grid');this.find('[data-picker-upload-status]')?.replaceChildren();this.search.focus();this.load();
 }
 close(){if(!this.active||this.busy)return;this.request?.abort();clearTimeout(this.timer);++this.sequence;this.active=false;this.root.hidden=true;this.root.parentElement.classList.remove('media-picker-open');this.siblings.forEach(({el,inert})=>el.inert=inert);this.dialog.setAttribute('aria-labelledby',this.originalTitle);this.trigger?.focus();}
 view(value){this.root.dataset.view=value;this.root.querySelectorAll('[data-picker-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pickerView===value)));}
 controls(){this.root.querySelectorAll('button,input,select').forEach(el=>el.disabled=this.busy);this.find('[data-picker-confirm]').disabled=this.busy||!this.chosen.size;this.find('[data-picker-count]').textContent=this.labels.selected+': '+this.chosen.size;this.renderItems();}
 async load(){
  clearTimeout(this.timer);this.request?.abort();this.request=new AbortController();const current=++this.sequence;this.notice.textContent=this.labels.loading;this.items=[];this.renderItems();
  const params=new URLSearchParams({path:this.path,query:this.search.value.trim(),scope:this.scope.value,sort:'name',partial:'1'});
  try{const response=await fetch('/cpanel/media?'+params,{signal:this.request.signal,headers:{Accept:'text/html'}});if(response.redirected||!response.ok)throw Object.assign(Error(),{status:response.status});const html=await response.text();if(!this.active||current!==this.sequence)return;
   const doc=new DOMParser().parseFromString(html,'text/html');this.items=[...doc.querySelectorAll('[data-entry]')].map(el=>JSON.parse(el.dataset.entry));
   this.notice.textContent=[...doc.querySelectorAll('.media-message,.alert')].map(el=>el.textContent.trim()).join(' ');if(!this.items.length&&!this.notice.textContent)this.notice.textContent=this.search.value?this.labels.noResults:this.labels.empty;
  }catch(error){if(error.name==='AbortError'||current!==this.sequence||!this.active)return;this.notice.textContent=error.status===403?this.labels.denied:error.status===404?this.labels.notFound:this.labels.failed;this.chosen.clear();}
  finally{if(this.active&&current===this.sequence){this.breadcrumbs();this.controls();}}
 }
 breadcrumbs(){const nav=this.find('[data-picker-breadcrumb]');nav.replaceChildren();let path='';for(const name of [this.labels.root,...this.path.split('/').filter(Boolean)]){const destination=path;const button=document.createElement('button');button.type='button';button.className='btn btn-sm btn-link';button.textContent=name;const index=nav.children.length;if(index){path=this.path.split('/').slice(0,index).join('/');}const target=index?path:destination;button.disabled=this.busy;button.addEventListener('click',()=>this.navigate(target));nav.append(button);}}
 navigate(path){if(this.busy)return;this.path=path;this.search.value='';this.load();}
 eligible(item){return !item.folder&&Boolean(item.url)&&(!this.permanentOnly||!item.temporary&&item.path.split('/')[0]!=='cache')&&(this.mediaType==='all'||this.mediaType==='image'&&item.image===true&&item.type==='image');}
 renderItems(){
  const container=this.find('[data-picker-items]');container.replaceChildren();
  for(const item of this.items){const button=document.createElement('button');button.type='button';button.className='picker-item';button.dataset.pickerPath=item.path;button.title=item.path;button.append(mediaPreview(item));const label=document.createElement('span');label.textContent=item.name;button.append(label);const info=document.createElement('small');info.textContent=item.parent;button.append(info);
   if(!item.folder){button.setAttribute('aria-pressed',String(this.chosen.has(item.path)));button.disabled=this.busy||this.exclude.has(item.path)||!this.eligible(item);if(this.exclude.has(item.path))button.title+=' — '+this.labels.excluded;else if(!item.url)button.title+=' — '+this.labels.noUrl;else if(!this.eligible(item))button.title+=' — '+this.find(this.permanentOnly&&(item.temporary||item.path.split('/')[0]==='cache')?'[data-picker-permanent-only]':'[data-picker-image-only]').textContent;}else button.disabled=this.busy;
   button.addEventListener('click',()=>{if(item.folder){this.navigate(item.path);return;}if(!this.eligible(item)||this.exclude.has(item.path))return;if(this.mode==='single')this.chosen.clear();if(this.chosen.has(item.path))this.chosen.delete(item.path);else this.chosen.set(item.path,item);this.controls();});container.append(button);}
 }
 async confirm(){
  if(this.busy||!this.chosen.size)return;this.busy=true;this.controls();this.notice.textContent=this.labels.loading;
  try{const selected=[];for(const path of this.chosen.keys()){const response=await fetch('/cpanel/api/media/details?'+new URLSearchParams({path}));if(response.redirected||!response.ok)throw Object.assign(Error(),{status:response.status});const {item}=await response.json();if(!this.eligible(item)||this.exclude.has(item.path))throw Error();selected.push({path:item.path,url:item.url,name:item.name,image:item.image,type:item.type});}this.busy=false;this.close();this.onSelect(selected);
  }catch(error){this.busy=false;this.notice.textContent=error.status===403?this.labels.denied:this.labels.failed;this.controls();}
 }
 async upload(files){
  if(this.busy||!files.length)return;this.busy=true;this.request?.abort();++this.sequence;this.controls();const status=this.find('[data-picker-upload-status]');status.replaceChildren();
  for(const file of files.slice(0,100)){const line=document.createElement('p');line.textContent=file.name+' — '+this.labels.working;status.append(line);
   try{if(file.size>10485760)throw Object.assign(Error(),{code:'MEDIA_FILE_TOO_LARGE'});const body=new FormData();body.append('file',file);const response=await fetch('/cpanel/api/media/files?'+new URLSearchParams({path:this.path}),{method:'POST',headers:{'X-CSRF-Token':this.root.dataset.csrf},body});const data=await response.json().catch(()=>({}));if(response.status!==201||!data.success)throw Object.assign(Error(),{code:data.error?.code,status:response.status});line.textContent=file.name+' — '+this.labels.uploaded;
   }catch(error){line.textContent=file.name+' — '+(error.status===403?this.labels.denied:error.code==='MEDIA_ALREADY_EXISTS'?this.labels.conflict:error.code==='MEDIA_FILE_TOO_LARGE'?this.labels.large:error.code==='MEDIA_INVALID_PATH'||error.code==='MEDIA_CACHE_PROTECTED'?this.labels.forbiddenPath:this.labels.failed);}
  }
  this.find('[data-picker-files]').value='';this.busy=false;this.search.value='';await this.load();
 }
}
