import {AsyncAutocomplete} from './async-autocomplete.js';
import {mediaPreview} from '../media/preview.js';
/** Shared committed relationship UI; parent editors retain ownership of unrelated drafts. */
export class AttachedProducts {
 constructor(root,{kind,csrf,canView,canUpdate,onCounts}){
  Object.assign(this,{root,kind,csrf,canView,canUpdate,onCounts});this.find=s=>root.querySelector(s);
  this.labels=Object.fromEntries([...root.querySelectorAll('[data-attachment-label]')].map(e=>[e.dataset.attachmentLabel,e.textContent]));
  this.generation=0;this.rows=[];this.busy=false;
  this.control=new AsyncAutocomplete(this.find('.async-autocomplete'),{
   fetchPage:async({query,page,signal})=>{const r=await this.request('?'+new URLSearchParams({lookup:'1',query,page:String(page)}),undefined,signal);return {...r,options:r.rows.map(row=>this.option(row))};},
   hydrate:async(value,signal)=>{const r=await this.request('?'+new URLSearchParams({lookup:'1',selected:value}),undefined,signal);return r.rows[0]?this.option(r.rows[0]):null;},
   onChange:option=>{if(option)void this.mutate('attach',option.value);}
  });
  this.find('[data-attached-more]').addEventListener('click',()=>this.load(this.nextPage));
  this.find('[data-attached-retry]').addEventListener('click',()=>this.load(this.failedPage||1));
  this.find('[data-move-cancel]').addEventListener('click',()=>{this.pending=null;this.find('[data-move-confirm]').hidden=true;this.state();this.control.input.focus();});
  this.find('[data-move-accept]').addEventListener('click',()=>{if(this.pending)void this.mutate('attach',this.pending.product,this.pending.currentId);});
  root.closest('.modal').addEventListener('hide.bs.modal',event=>{if(this.busy)event.preventDefault();});
  root.closest('.modal').addEventListener('hidden.bs.modal',()=>this.reset(null));
 }
 option(row){return {value:row.id,label:row.name,secondaryText:[row.vendor,row.source,this.kind==='brands'?row.brand:this.kind==='categories'?row.category:null].filter(Boolean).join(' · ')};}
 async request(path,body,signal){const response=await fetch('/cpanel/api/products/attachments/'+this.kind+'/'+this.id+path,{method:body===undefined?'GET':'POST',signal,headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':this.csrf})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw Object.assign(Error(),data,{status:response.status});return data;}
 reset(id){++this.generation;this.requestController?.abort();this.id=id;this.rows=[];this.pending=null;this.find('[data-move-confirm]').hidden=true;this.find('[data-attached-status]').textContent='';this.find('[data-attached-list]').replaceChildren();this.find('[data-attached-more]').hidden=true;this.find('[data-attached-retry]').hidden=true;void this.control.setValue('');this.state();}
 state(){const disabled=!this.id||!this.canView||!this.canUpdate||this.busy||Boolean(this.pending);this.control.disabled=disabled;this.control.input.disabled=disabled;this.control.updateClear();this.root.querySelectorAll('[data-detach-product]').forEach(b=>b.disabled=!this.canUpdate||this.busy);this.find('[data-move-accept]').disabled=this.busy;this.find('[data-move-cancel]').disabled=this.busy;}
 async load(page=1){
  if(!this.id||!this.canView){this.find('[data-attached-status]').textContent=this.labels.denied;return;}
  this.requestController?.abort();this.requestController=new AbortController();const generation=++this.generation;
  this.failedPage=page;this.find('[data-attached-retry]').hidden=true;this.find('[data-attached-more]').hidden=true;this.find('[data-attached-status]').textContent=this.labels.loading;
  try{const data=await this.request('?page='+page,undefined,this.requestController.signal);if(generation!==this.generation)return;this.rows=page===1?data.rows:[...this.rows,...data.rows.filter(r=>!this.rows.some(old=>old.id===r.id))];this.nextPage=data.nextPage;this.render();this.onCounts(data.counts);this.find('[data-attached-more]').hidden=!data.hasMore;this.find('[data-attached-status]').textContent=this.rows.length?'':this.labels.empty;return true;}
  catch(error){if(generation===this.generation&&error.name!=='AbortError'){this.find('[data-attached-status]').textContent=error.status===403?this.labels.denied:this.labels.error;this.find('[data-attached-retry]').hidden=false;}}
 }
 render(){const list=this.find('[data-attached-list]');list.replaceChildren();for(const row of this.rows){
  const article=document.createElement('article');article.className='d-flex align-items-center gap-3 border-bottom py-2';article.dataset.attachedProduct=row.id;
  const picture=document.createElement('div');picture.style.cssText='width:48px;height:48px;flex-shrink:0';picture.append(mediaPreview(row.image));article.append(picture);
  const info=document.createElement('div');info.className='flex-grow-1';const name=document.createElement('strong'),detail=document.createElement('small'),visibility=document.createElement('span');name.textContent=row.name;detail.className='d-block text-body-secondary';detail.textContent=row.vendor+' · '+row.source;visibility.className='badge '+(row.is_visible?'text-bg-success':'text-bg-secondary');visibility.textContent=row.is_visible?this.labels.visible:this.labels.hidden;info.append(name,detail,visibility);article.append(info);
  const menu=document.createElement('div');menu.className='dropdown';const toggle=document.createElement('button');toggle.type='button';toggle.className='shell-icon-button';toggle.dataset.bsToggle='dropdown';toggle.setAttribute('aria-label',this.labels.actions);toggle.textContent='⋮';const items=document.createElement('div');items.className='dropdown-menu dropdown-menu-end';const detach=document.createElement('button');detach.type='button';detach.className='dropdown-item';detach.dataset.detachProduct=row.id;detach.textContent=this.labels.detach;detach.addEventListener('click',()=>this.mutate('detach',row.id));items.append(detach);menu.append(toggle,items);article.append(menu);list.append(article);
 }this.state();}
 async mutate(operation,product,expected){
  if(this.busy||!this.id||!this.canUpdate||!this.canView)return;
  this.busy=true;this.control.close();this.state();this.find('[data-attached-status]').textContent=this.labels.loading;
  try{const data=await this.request('/'+operation,{product_id:product,...(expected===undefined?{}:{expected_parent_id:expected})});this.pending=null;this.find('[data-move-confirm]').hidden=true;this.onCounts(data.counts);
   if(operation==='attach')await this.control.setValue('');const refreshed=await this.load();if(refreshed)this.find('[data-attached-status]').textContent=this.labels[operation==='attach'?'attached':'detached'];
  }catch(error){if(error.code==='PRODUCT_MOVE_REQUIRED'&&error.move){this.pending={product,...error.move};this.find('[data-move-description]').textContent=error.move.productName+' — '+this.labels.current+': '+error.move.currentName+'. '+this.labels.destination+': '+error.move.targetName+'?';this.find('[data-move-confirm]').hidden=false;this.find('[data-attached-status]').textContent='';}
   else this.find('[data-attached-status]').textContent=error.status===403?this.labels.denied:this.labels.error;
  }finally{this.busy=false;this.state();if(this.pending)this.find('[data-move-accept]').focus();else if(operation==='attach')this.control.input.focus();}
 }
}
