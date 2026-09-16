/** Single-select server entity control. Options are identities, never parsed display text.
 * fetchPage({query,page,signal}) -> {options,hasMore,nextPage}; hydrate(value,signal) -> option|null.
 * All option labels/secondaryText are rendered as text. No entity-specific logic lives here.
 */
export class AsyncAutocomplete {
 constructor(root,{fetchPage,hydrate,onChange=()=>{},onHydrate=()=>{},required=false,clearable=true,disabled=false,readOnly=false,placeholder,debounce=300}) {
  Object.assign(this,{root,fetchPage,hydrate,onChange,onHydrate,required,clearable,disabled,readOnly,debounce});
  this.input=root.querySelector('[data-ac-input]');this.panel=root.querySelector('[data-ac-panel]');this.list=root.querySelector('[role=listbox]');this.status=root.querySelector('[data-ac-status]');this.more=root.querySelector('[data-ac-more]');this.retry=root.querySelector('[data-ac-retry]');this.clearButton=root.querySelector('[data-ac-clear]');
  this.labels=Object.fromEntries([...root.querySelectorAll('[data-ac-label]')].map(el=>[el.dataset.acLabel,el.textContent]));
  this.selected=null;this.options=[];this.generation=0;this.hydrationGeneration=0;this.active=-1;this.search='';
  if(placeholder!==undefined)this.input.placeholder=placeholder;
  this.input.required=required;this.input.disabled=disabled;this.input.readOnly=readOnly;this.input.setAttribute('aria-readonly',String(readOnly));this.input.setAttribute('aria-required',String(required));
  this.updateClear();this.input.addEventListener('click',()=>this.open());
  this.input.addEventListener('input',()=>{this.cancel();this.search=this.input.value;this.show();this.options=[];this.render();this.status.textContent=this.labels.loading;this.timer=setTimeout(()=>this.load(1),this.debounce);});
  this.input.addEventListener('keydown',event=>{
   if(this.disabled||this.readOnly)return;
   if(event.key==='Escape'){event.preventDefault();this.close();return;}
   if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(this.panel.hidden){this.open();return;}if(!this.options.length)return;this.active=this.active<0?(event.key==='ArrowDown'?0:this.options.length-1):(this.active+(event.key==='ArrowDown'?1:-1)+this.options.length)%this.options.length;this.highlight();}
   if(event.key==='Enter'&&!this.panel.hidden){event.preventDefault();if(this.active>=0&&this.options[this.active])this.choose(this.options[this.active]);}
  });
  this.clearButton.addEventListener('click',()=>{this.setValue('');this.onChange(null);this.input.focus();});
  this.more.addEventListener('click',()=>this.load(this.nextPage));this.retry.addEventListener('click',()=>this.hydrationFailed?this.setValue(this.value):this.load(this.failedPage||1));
  this.root.addEventListener('focusout',()=>{setTimeout(()=>{if(!this.root.contains(document.activeElement))this.close();},0);});
  this.outside=event=>{if(!root.contains(event.target))this.close();};document.addEventListener('pointerdown',this.outside);
 }
 get value(){return this.selected?.value??this.pendingValue??'';}
 updateClear(){this.input.setCustomValidity(this.required&&!this.selected?(this.labels.search||this.labels.empty):'');this.clearButton.hidden=!this.clearable||this.required||this.disabled||this.readOnly||!this.value;}
 cancel(){clearTimeout(this.timer);this.controller?.abort();++this.generation;this.loading=false;this.input.removeAttribute('aria-busy');}
 show(){this.panel.hidden=false;this.input.setAttribute('aria-expanded','true');}
 open(){if(this.disabled||this.readOnly||!this.panel.hidden)return;this.search='';this.show();if(this.hydrationFailed){this.status.textContent=this.labels.failed;this.retry.hidden=false;return;}this.load(1);}
 close(){this.cancel();this.panel.hidden=true;this.input.setAttribute('aria-expanded','false');this.input.removeAttribute('aria-activedescendant');this.input.value=this.selected?.label??'';}
 async setValue(value){
  this.close();this.hydrationController?.abort();const generation=++this.hydrationGeneration;
  this.pendingValue=value||'';this.selected=null;this.hydrationFailed=false;this.input.value='';this.updateClear();
  if(!value){this.input.placeholder=this.root.dataset.placeholder??this.input.placeholder;return;}
  const controller=new AbortController();this.hydrationController=controller;this.input.placeholder=this.labels.loading;this.input.setAttribute('aria-busy','true');
  try{const option=await this.hydrate(String(value),controller.signal);if(generation!==this.hydrationGeneration)return;if(!option)throw Error();this.selected=option;this.pendingValue='';if(this.panel.hidden)this.input.value=option.label;this.onHydrate(option);}
  catch(error){if(generation!==this.hydrationGeneration||error.name==='AbortError')return;this.hydrationFailed=true;this.input.placeholder=this.labels.failed;this.status.textContent=this.labels.failed;this.retry.hidden=false;this.onHydrate(null);}
  finally{if(generation===this.hydrationGeneration){this.input.removeAttribute('aria-busy');if(!this.hydrationFailed)this.input.placeholder=this.root.dataset.placeholder||'';this.updateClear();}}
 }
 choose(option){this.hydrationController?.abort();++this.hydrationGeneration;this.pendingValue='';this.hydrationFailed=false;this.selected=option;this.close();this.updateClear();this.onChange(option);this.input.focus();}
 async load(page){
  if(this.loading||!page)return;this.cancel();const generation=this.generation;this.controller=new AbortController();this.loading=true;this.failedPage=page;this.retry.hidden=true;this.more.hidden=true;this.status.textContent=this.labels.loading;this.input.setAttribute('aria-busy','true');
  if(page===1){this.options=[];this.active=-1;this.render();}
  try{const data=await this.fetchPage({query:this.search,page,signal:this.controller.signal});if(generation!==this.generation)return;
   this.options=page===1?data.options:[...this.options,...data.options.filter(item=>!this.options.some(old=>old.value===item.value))];this.nextPage=data.hasMore?data.nextPage:null;this.render();this.status.textContent=this.options.length?'':this.labels.empty;this.more.hidden=!this.nextPage;
  }catch(error){if(generation!==this.generation||error.name==='AbortError')return;this.status.textContent=this.labels.failed;this.retry.hidden=false;this.onHydrate(null);}
  finally{if(generation===this.generation){this.loading=false;this.input.removeAttribute('aria-busy');}}
 }
 render(){this.list.replaceChildren();this.input.removeAttribute('aria-activedescendant');this.active=-1;for(const [index,option]of this.options.entries()){
  const item=document.createElement('div');item.id=this.list.id+'-'+index;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===this.value));item.className='async-option';item.append(document.createTextNode(option.label));
  if(option.secondaryText){const secondary=document.createElement('small');secondary.className='d-block text-body-secondary';secondary.textContent=option.secondaryText;item.append(secondary);}
  item.addEventListener('mousedown',event=>event.preventDefault());item.addEventListener('click',()=>this.choose(option));this.list.append(item);
 }}
 highlight(){[...this.list.children].forEach((el,index)=>el.classList.toggle('is-focused',index===this.active));const item=this.list.children[this.active];if(item){this.input.setAttribute('aria-activedescendant',item.id);item.scrollIntoView({block:'nearest'});}}
 destroy(){this.cancel();this.hydrationController?.abort();++this.hydrationGeneration;document.removeEventListener('pointerdown',this.outside);}
}
