import {createContentEditor} from './content/entity-editor.js';
import {contentText} from './content/editor-state.js';
import {mediaPreview} from './media/preview.js';
const root=document.querySelector('#categories-page'),find=id=>root.querySelector('#'+id);
const initial=JSON.parse(find('categories-data').textContent),languages=initial.languages,can=JSON.parse(root.dataset.capabilities);
const labels=Object.fromEntries([...root.querySelectorAll('[data-label]')].map(el=>[el.dataset.label,el.textContent]));
let moveRow=null,moveParent=null,moveBusy=false;
let rows=initial.rows,current=initial.parent,breadcrumbs=initial.breadcrumbs,total=initial.total,page=initial.page,timer,activeEditor,opening=false,listRequest,generation=0,parentGeneration=0,parentPage=1;
const paths=new Map(),text=row=>contentText(row.basic.name,row.translations[document.documentElement.lang]);
function remember(row){for(const [index,item]of row.ancestry.entries())paths.set(item.id,row.ancestry.slice(0,index+1));}
function pathLabel(id){return id?(paths.get(id)??[]).map(item=>item.name).join(' / '):labels.root;}
const errors={CATEGORY_INVALID_PARENT:'invalidParent',CATEGORY_INVALID_SLUG:'invalidSlug',CATEGORY_SLUG_TAKEN:'slugTaken',CATEGORY_INVALID_SEO:'invalidSeo',CATEGORY_FORBIDDEN:'denied',CATEGORY_NOT_FOUND:'notFound',CATEGORY_INVALID_REQUEST:'invalidRequest',CATEGORY_INVALID_NAME:'invalidName',CATEGORY_INVALID_LANGUAGE:'invalidLanguage',CATEGORY_INVALID_MEDIA:'invalidMedia',CATEGORY_DUPLICATE_MEDIA:'duplicate',CATEGORY_GALLERY_CONFLICT:'conflict'};
const message=error=>labels[errors[error.code]??'error'];
async function request(url,method='GET',body,signal){const response=await fetch(url,{method,signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(response.redirected||!response.ok||!data.success)throw Object.assign(Error(),{code:response.status===403?'CATEGORY_FORBIDDEN':data.code});return data;}
function render(){
 rows.forEach(remember);for(const [index,item]of breadcrumbs.entries())paths.set(item.id,breadcrumbs.slice(0,index+1));
 const nav=find('category-breadcrumbs');nav.replaceChildren();const trail=[{id:null,name:labels.root},...breadcrumbs];
 for(const [index,item]of trail.entries()){const button=document.createElement('button');button.type='button';button.className='btn btn-link';button.textContent=item.name;button.dataset.categoryCrumb=item.id??'';if(index===trail.length-1){button.setAttribute('aria-current','page');button.disabled=true;}nav.append(button);if(index<trail.length-1){const separator=document.createElement('span');separator.textContent='/';separator.setAttribute('aria-hidden','true');nav.append(separator);}}
 find('categories-prev').disabled=page<=1;find('categories-next').disabled=page*50>=total;find('categories-page-number').textContent=page+' / '+Math.max(1,Math.ceil(total/50));
 find('categories-items').replaceChildren();find('categories-empty').hidden=rows.length>0;
 for(const row of rows){const item=find('category-template').content.firstElementChild.cloneNode(true);item.dataset.categoryId=row.id;item.classList.toggle('is-hidden',!row.basic.is_visible);item.querySelector('[data-name]').textContent=text(row);item.querySelector('[data-path]').textContent=find('categories-search').value.trim()?pathLabel(row.basic.parentId):'';item.querySelector('.brand-image').append(mediaPreview(row.basic.mainMedia));item.querySelector('[data-child-count]').textContent=labels.children+': '+row.childCount;item.querySelector('[data-product-count]').textContent=labels.products+': '+row.totalProducts;item.querySelector('.brand-visibility').textContent=row.basic.is_visible?labels.visible:labels.hidden;find('categories-items').append(item);}
}
async function refresh(nextPage=page,parent=current){
 clearTimeout(timer);listRequest?.abort();listRequest=new AbortController();const token=++generation;find('categories-feedback').textContent=labels.loading;
 try{const result=await request('/cpanel/api/categories?'+new URLSearchParams({parent:parent??'',query:find('categories-search').value.trim(),visibility:find('categories-filter').value,page:String(nextPage)}),'GET',undefined,listRequest.signal);if(token!==generation)return;({rows,breadcrumbs,total,page}=result);current=result.parent;history.replaceState(null,'','#'+(current??''));render();find('categories-feedback').textContent='';}catch(error){if(error.name!=='AbortError'&&token===generation)find('categories-feedback').textContent=message(error);}
}
function navigate(id){find('categories-search').value='';void refresh(1,id);}
find('category-breadcrumbs').addEventListener('click',event=>{const button=event.target.closest('[data-category-crumb]');if(button)navigate(button.dataset.categoryCrumb||null);});
find('categories-search').addEventListener('input',()=>{clearTimeout(timer);listRequest?.abort();++generation;timer=setTimeout(()=>refresh(1),250);});find('categories-filter').addEventListener('change',()=>refresh(1));
find('categories-prev').addEventListener('click',()=>refresh(page-1));find('categories-next').addEventListener('click',()=>refresh(page+1));
function view(value){root.dataset.view=value;root.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===value)));try{localStorage.setItem('hormat.cpanel.categories.view',value);}catch{}}
try{view(localStorage.getItem('hormat.cpanel.categories.view')==='list'?'list':'grid');}catch{view('grid');}
root.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
async function parentOptions(nextPage=1){
 const token=++parentGeneration,query=find('category-parent-search').value.trim(),target=activeEditor.editor.id;
 const items=find('category-parent-options');items.replaceChildren();find('category-parent-feedback').textContent=labels.loading;
 find('category-parent-prev').disabled=true;find('category-parent-next').disabled=true;
 const choice=(id,label,disabled=false)=>{const button=document.createElement('button');button.type='button';button.className='btn btn-outline-secondary category-parent-choice';button.dataset.parentChoice=id??'';button.textContent=label;button.setAttribute('aria-pressed',String(activeEditor.editor.sections.basic.draft.parentId===id));button.disabled=disabled||(moveRow&&id===moveRow.basic.parentId);return button;};
 const load=(parent,page=1)=>request('/cpanel/api/categories?'+new URLSearchParams({parent:parent??'',query,exclude:target??'',page:String(page)}));
 async function branch(result,container){for(const row of result.rows){remember(row);const node=document.createElement('div');node.className='category-tree-branch';node.append(choice(row.id,query?pathLabel(row.id):text(row),row.parentDisabled));
  if(!query&&row.childCount){const details=document.createElement('details'),summary=document.createElement('summary'),nested=document.createElement('div');summary.textContent=labels.children+': '+row.childCount;details.append(summary,nested);let loaded=false,loading=false;
   details.addEventListener('toggle',async()=>{if(!details.open||loaded||loading)return;loading=true;try{const data=await load(row.id);if(token!==parentGeneration)return;await branch(data,nested);loaded=true;}catch(error){find('category-parent-feedback').textContent=message(error);}finally{loading=false;}});node.append(details);}
  container.append(node);}
  if(container!==items&&result.page*result.pageSize<result.total){const more=document.createElement('button');more.type='button';more.className='btn btn-outline-secondary';more.textContent=find('category-parent-next').textContent;more.addEventListener('click',async()=>{more.disabled=true;try{const data=await load(result.parent,result.page+1);if(token!==parentGeneration)return;more.remove();await branch(data,container);}catch(error){more.disabled=false;find('category-parent-feedback').textContent=message(error);}});container.append(more);}
 }
 try{const result=await load(null,nextPage);if(token!==parentGeneration)return;parentPage=result.page;items.append(choice(null,labels.root));await branch(result,items);find('category-parent-prev').disabled=result.page<=1;find('category-parent-next').disabled=result.page*result.pageSize>=result.total;find('category-parent-feedback').textContent='';}catch(error){if(token===parentGeneration)find('category-parent-feedback').textContent=message(error);}
}
find('category-parent-toggle').addEventListener('click',()=>{const panel=find('category-parent-picker');panel.hidden=!panel.hidden;find('category-parent-toggle').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){find('category-parent-search').value='';void parentOptions();find('category-parent-search').focus();}else ++parentGeneration;});
find('category-parent-search').addEventListener('input',()=>parentOptions());find('category-parent-prev').addEventListener('click',()=>parentOptions(parentPage-1));find('category-parent-next').addEventListener('click',()=>parentOptions(parentPage+1));
find('category-parent-options').addEventListener('click',event=>{const button=event.target.closest('[data-parent-choice]');if(!button||button.disabled)return;activeEditor.updateBasic({parentId:button.dataset.parentChoice||null});find('category-parent-picker').hidden=true;++parentGeneration;find('category-parent-toggle').setAttribute('aria-expanded','false');find('category-parent-toggle').focus();});
find('brand-dialog').addEventListener('hidden.bs.modal',()=>{++parentGeneration;});
const editor=createContentEditor({kind:'categories',root,can,labels,languages,initialBasic:()=>({parentId:current}),message,
 productsText:row=>labels.direct+': '+(row?.directProducts??0)+' · '+labels.total+': '+(row?.totalProducts??0),
 onRender:state=>{activeEditor=state;const {editor,busy}=state;find('category-parent-toggle').textContent=pathLabel(editor.sections.basic.draft.parentId);find('category-parent-toggle').disabled=busy||!(editor.id?can.update:can.create);find('category-edit-path').textContent=labels.path+': '+pathLabel(editor.sections.basic.draft.parentId)+' / '+editor.sections.basic.draft.name;},
 onSaved:row=>{remember(row);void refresh();},
 async persist({id,key,value,saved,create}){
  let url='/cpanel/api/categories',method,body;
  if(create){method='POST';body={name:value.name,parent_id:value.parentId};}
  else if(key==='basic'){url+='/'+id;method='PATCH';body={};if(can.update){if(value.name!==saved.name)body.name=value.name;if(value.parentId!==saved.parentId)body.parent_id=value.parentId;if((value.mainMedia?.path??null)!==(saved.mainMedia?.path??null))body.main_media_reference=value.mainMedia?.path??null;}if(can.visibility&&value.is_visible!==saved.is_visible)body.is_visible=value.is_visible;}
  else if(key==='seo'){url+='/'+id+'/seo';method='PATCH';body=Object.fromEntries(['slug','seo_title','seo_description'].filter(field=>value[field]!==saved[field]).map(field=>[field,value[field]]));}
  else{url+='/'+id+'/gallery';method='PUT';body={items:value.map(item=>item.path),original:saved.map(item=>item.path)};}
  return request(url,method,body);
 },persistTranslations:(id,field,translations)=>request('/cpanel/api/categories/'+id+'/translations','PUT',{field,translations})
});
function edit(row){++parentGeneration;find('category-parent-picker').hidden=true;find('category-parent-toggle').setAttribute('aria-expanded','false');if(row)remember(row);editor.open(row);}
find('categories-add')?.addEventListener('click',()=>{if(can.create&&!opening)edit(null);});
const moveDialog=find('category-move-dialog'),moveModal=bootstrap.Modal.getOrCreateInstance(moveDialog);
const parentField=find('category-parent-toggle').closest('.category-parent-field'),parentHome=document.createComment('shared parent picker');parentField.before(parentHome);
function movePresentation(){
 find('category-parent-toggle').textContent=pathLabel(moveParent);find('category-parent-toggle').disabled=moveBusy;
 find('category-edit-path').hidden=true;
 find('category-move-new').textContent=pathLabel(moveParent)+' / '+moveRow.basic.name;
 find('category-move-confirm').disabled=moveBusy||moveParent===moveRow.basic.parentId;
 find('category-move-confirm').textContent=moveBusy?labels.saving:labels.move;
 moveDialog.querySelectorAll('[data-bs-dismiss]').forEach(button=>button.disabled=moveBusy);
}
function openMove(row){
 if(!can.update)return;remember(row);moveRow=row;moveParent=row.basic.parentId;moveBusy=false;
 find('category-move-name').textContent=row.basic.name;find('category-move-current').textContent=pathLabel(row.basic.parentId);find('category-move-feedback').textContent='';
 activeEditor={editor:{id:row.id,sections:{basic:{draft:{parentId:moveParent}}}},updateBasic:patch=>{if(moveBusy)return;moveParent=patch.parentId;activeEditor.editor.sections.basic.draft.parentId=moveParent;movePresentation();}};
 find('category-move-picker-slot').append(parentField);find('category-parent-picker').hidden=false;find('category-parent-toggle').setAttribute('aria-expanded','true');find('category-parent-search').value='';
 movePresentation();moveModal.show();void parentOptions();
}
find('category-move-confirm').addEventListener('click',async()=>{
 if(!can.update||!moveRow||moveBusy||moveParent===moveRow.basic.parentId)return;
 moveBusy=true;++parentGeneration;find('category-parent-picker').hidden=true;find('category-parent-toggle').setAttribute('aria-expanded','false');movePresentation();
 try{const result=await request('/cpanel/api/categories/'+moveRow.id,'PATCH',{parent_id:moveParent});remember(result.row);moveBusy=false;moveModal.hide();await refresh();find('categories-feedback').textContent=labels.moved;}
 catch(error){moveBusy=false;movePresentation();find('category-move-feedback').textContent=message(error);}
});
moveDialog.addEventListener('hide.bs.modal',event=>{if(moveBusy)event.preventDefault();});
moveDialog.addEventListener('hidden.bs.modal',()=>{++parentGeneration;parentHome.after(parentField);find('category-edit-path').hidden=false;find('category-parent-picker').hidden=true;moveRow=null;activeEditor=undefined;});
find('categories-items').addEventListener('click',async event=>{const button=event.target.closest('[data-category-action]');if(!button||opening)return;const id=button.closest('[data-category-id]').dataset.categoryId;if(button.dataset.categoryAction==='open'){navigate(id);return;}opening=true;find('categories-feedback').textContent=labels.loading;try{const {row}=await request('/cpanel/api/categories/'+id);if(button.dataset.categoryAction==='move')openMove(row);else edit(row);if(button.dataset.categoryAction==='visibility')find('brand-visibility').focus();find('categories-feedback').textContent='';}catch(error){find('categories-feedback').textContent=message(error);}finally{opening=false;}});
function locationChanged(){find('categories-search').value='';void refresh(1,location.hash.slice(1)||null);}
window.addEventListener('hashchange',locationChanged);
render();if(location.hash.slice(1))locationChanged();
