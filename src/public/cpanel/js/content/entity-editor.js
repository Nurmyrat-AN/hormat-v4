import {AttachedProducts} from './attached-products.js';
import {ContentEditorState} from './editor-state.js';
import {TranslatableField} from './translatable-field.js';
import {MediaPicker} from '../media/picker.js';
import {mediaPreview} from '../media/preview.js';
/** Shared content dialog. Callers own persistence and domain-specific parent/product presentation. */
export function createContentEditor({kind,root,can,labels,languages,persist,persistTranslations,onSaved,message,productsText,initialBasic=()=>({}),onRender}){
const dialog=root.querySelector('[data-content-dialog]'),modal=bootstrap.Modal.getOrCreateInstance(dialog);
const find=id=>dialog.querySelector('#'+id),name=find('brand-name'),visibility=find('brand-visibility');
const picker=new MediaPicker(root.querySelector('[data-media-picker]'),dialog);
let editor,selected,tab='basic',busy=false,discard=false,lastError='';
const attachments=new AttachedProducts(dialog.querySelector('[data-attached-products]'),{kind,csrf:root.dataset.csrf,canView:can.productView,canUpdate:can.update,onCounts:counts=>{if(selected){Object.assign(selected,kind==='categories'?{directProducts:counts.direct,totalProducts:counts.total}:{productCount:counts.direct});find('brand-product-count').textContent=productsText(selected);onSaved(selected);}}});
const copy=value=>structuredClone(value);
const fields=['name','seo_title','seo_description'];
const scope=field=>field==='name'?'basic':'seo';
const scopeFields=key=>key==='basic'?['name']:['slug','seo_title','seo_description'];
const translationFields=Object.fromEntries(fields.map(field=>{const control=new TranslatableField(root.querySelector('[data-translatable-field="brand-'+field+'"]'),{onChange:()=>status(),onSave:()=>saveTranslations(field)});control.labels.saved=labels.saved;return [field,control];}));
const overrides=(row,field)=>field==='name'?row?.translations??{}:row?.seoTranslations?.[field]??{};
const anyDirty=()=>editor?.anyDirty()||Object.values(translationFields).some(control=>control.state?.dirty());
function editable(key){return key==='basic'?(!editor.id?can.create:can.update||can.visibility):Boolean(editor.id&&can.update);}
function status(){
 dialog.dataset.mode=editor.id?'edit':'create';dialog.dataset.entityId=editor.id??'';find('brand-dialog-title').textContent=editor.id?labels.edit:labels.create;find('brand-locks').hidden=Boolean(editor.id);
 for(const button of dialog.querySelectorAll('[data-tab]')){const key=button.dataset.tab,locked=key!=='basic'&&!editor.id;button.disabled=busy||locked;button.classList.toggle('active',key===tab);button.setAttribute('aria-selected',String(key===tab));button.tabIndex=key===tab?0:-1;const state=editor.sections[key]?.state;if(key==='products'){button.querySelector('[data-tab-state]').textContent='';continue;}button.querySelector('[data-tab-state]').textContent=locked?labels.locked:state==='saving'?labels.saving:state==='error'?labels.error:editor.dirty(key)?labels.dirty:state==='saved'?labels.saved:'';}
 for(const pane of dialog.querySelectorAll('[data-pane]'))pane.hidden=pane.dataset.pane!==tab;
 for(const button of dialog.querySelectorAll('[data-save]')){const key=button.dataset.save;button.hidden=key!==tab;button.disabled=busy||!editable(key)||(Boolean(editor.id)&&!editor.dirty(key));button.textContent=editor.sections[key].state==='saving'?labels.saving:key==='basic'?(editor.id?labels.basicSave:labels.create):key==='seo'?labels.saveSeo:labels.saveGallery;}
 name.disabled=busy||!(editor.id?can.update:can.create);visibility.disabled=busy||!editor.id||!can.visibility;
 find('content-add-media').disabled=busy||!can.update||!editor.id||!can.mediaView;find('content-add-media').title=can.mediaView?'':labels.denied;mainImage();
 dialog.querySelectorAll('[data-bs-dismiss]').forEach(el=>el.disabled=busy);
 find('brand-product-count').textContent=productsText(selected);
 onRender?.({editor,selected,busy,updateBasic:patch=>{editor.set('basic',{...editor.sections.basic.draft,...patch});status();}});
 for(const field of fields){const input=find('brand-'+field);if(field!=='name')input.disabled=busy||!editor.id||!can.update;translationFields[field].render({base:input.value,baseDirty:input.value!==editor.sections[scope(field)].saved[field],locked:!editor.id,editable:can.update,busy});}
 find('brand-slug').disabled=busy||!editor.id||!can.update;
}
function mainImage(){
 const media=editor.sections.basic.draft.mainMedia;
 find('brand-main-preview').replaceChildren(mediaPreview(media));find('brand-main-identity').textContent=media?.path??labels.emptyMain;
 find('brand-main-select').textContent=media?labels.changeMedia:labels.selectMedia;find('brand-main-select').disabled=busy||!editor.id||!can.update||!can.mediaView;find('brand-main-select').title=can.mediaView?'':labels.denied;
 find('brand-main-remove').hidden=!media;find('brand-main-remove').disabled=busy||!editor.id||!can.update;find('brand-main-lock').hidden=Boolean(editor.id);
}
function gallery(){
 const values=editor.sections.gallery.draft,items=find('content-gallery');items.replaceChildren();find('content-gallery-empty').hidden=values.length>0;
 values.forEach((item,index)=>{const card=document.createElement('div');card.className='content-media';card.dataset.mediaPath=item.path;card.append(mediaPreview(item));const title=document.createElement('p');title.className='content-media-name';title.textContent=item.name;title.title=item.path;card.append(title);
 const menu=document.createElement('div');menu.className='dropdown gallery-menu';const toggle=document.createElement('button');toggle.type='button';toggle.className='shell-icon-button';toggle.dataset.bsToggle='dropdown';toggle.setAttribute('aria-label',labels.actions);toggle.innerHTML='<svg class="shell-icon" aria-hidden="true"><use href="/public/cpanel/images/shell-icons.svg#more"></use></svg>';menu.append(toggle);const list=document.createElement('ul');list.className='dropdown-menu dropdown-menu-end';
 for(const [action,label,disabled] of [['earlier',labels.earlier,index===0],['later',labels.later,index===values.length-1],['remove',labels.remove,false]]){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='dropdown-item';button.dataset.galleryAction=action;button.textContent=label;button.disabled=busy||!can.update||disabled;li.append(button);list.append(li);}menu.append(list);card.append(menu);items.append(card);});
}
function chooseMedia(purpose,trigger){
 if(busy||!editor.id||!can.update||!can.mediaView)return;
 picker.open({mediaType:'image',permanentOnly:true,initialSelection:purpose==='main'&&editor.sections.basic.draft.mainMedia?[editor.sections.basic.draft.mainMedia]:[],mode:purpose==='main'?'single':'multiple',exclude:purpose==='gallery'?editor.sections.gallery.draft.map(item=>item.path):[],trigger,onSelect:items=>{
  if(purpose==='main')editor.set('basic',{...editor.sections.basic.draft,mainMedia:items[0]});
  else{const values=copy(editor.sections.gallery.draft);for(const item of items)if(!values.some(value=>value.path===item.path))values.push(item);editor.set('gallery',values);}
  status();gallery();
 }});
}
find('brand-main-select').addEventListener('click',event=>chooseMedia('main',event.currentTarget));
find('brand-main-remove').addEventListener('click',()=>{if(busy||!can.update||!editor.id)return;editor.set('basic',{...editor.sections.basic.draft,mainMedia:null});status();});
function switchTab(key){if(busy||(!editor.id&&key!=='basic'))return;tab=key;status();if(key==='gallery')gallery();if(key==='products'){if(attachments.id!==editor.id)attachments.reset(editor.id);void attachments.load();}}
dialog.querySelectorAll('[data-tab]').forEach(button=>{button.addEventListener('click',()=>switchTab(button.dataset.tab));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...dialog.querySelectorAll('[data-tab]:not(:disabled)')],index=tabs.indexOf(button);const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.click();next.focus();});});
function open(row){attachments.reset(row?.id??null);selected=row;editor=new ContentEditorState({id:row?.id??null,basic:row?.basic??{name:'',is_visible:false,mainMedia:null,...initialBasic()},seo:row?.seo??{slug:'',seo_title:'',seo_description:''},gallery:row?.gallery??[]});for(const field of fields)translationFields[field].reset(overrides(row,field));tab='basic';discard=false;find('brand-discard').hidden=true;find('brand-status').textContent=!can.update&&!can.visibility&&row?labels.readOnly:'';for(const field of [...fields,'slug'])find('brand-'+field).value=editor.sections[scope(field)].draft[field];visibility.value=editor.sections.basic.draft.is_visible?'visible':'hidden';name.classList.remove('is-invalid');name.removeAttribute('aria-invalid');find('brand-name-error').textContent='';find('brand-name-error').hidden=true;status();gallery();modal.show();}

function basicChanged(){editor.set('basic',{...editor.sections.basic.draft,name:name.value,is_visible:visibility.value==='visible'});status();}
name.addEventListener('input',basicChanged);for(const field of scopeFields('seo'))find('brand-'+field).addEventListener('input',()=>{editor.set('seo',Object.fromEntries(scopeFields('seo').map(key=>[key,find('brand-'+key).value])));status();});visibility.addEventListener('change',basicChanged);
find('content-add-media').addEventListener('click',event=>chooseMedia('gallery',event.currentTarget));
find('content-gallery').addEventListener('click',event=>{const button=event.target.closest('[data-gallery-action]');if(!button||button.disabled||!can.update||busy)return;const values=copy(editor.sections.gallery.draft),index=values.findIndex(item=>item.path===button.closest('[data-media-path]').dataset.mediaPath),action=button.dataset.galleryAction;if(action==='remove')values.splice(index,1);else{const other=index+(action==='earlier'?-1:1);[values[index],values[other]]=[values[other],values[index]];}editor.set('gallery',values);gallery();status();});
function accept(state,value){state.saved=copy(value);state.draft=copy(value);state.state='saved';}
async function save(key){
 if(busy||!editable(key))return;
 if(key==='basic'&&!name.value.trim()){find('brand-name-error').textContent=labels.required;find('brand-name-error').hidden=false;name.classList.add('is-invalid');name.setAttribute('aria-invalid','true');name.focus();return;}
 if(key==='basic'){name.classList.remove('is-invalid');name.removeAttribute('aria-invalid');find('brand-name-error').hidden=true;editor.set('basic',{...editor.sections.basic.draft,name:name.value.trim(),is_visible:editor.id?visibility.value==='visible':false});}
 busy=true;lastError='';const create=!editor.id;let result;
 const saving=editor.save(key,async value=>{
  try{result=await persist({id:editor.id,key,value,saved:editor.sections[key].saved,create});}catch(error){lastError=message(error);throw error;}
 });
 status();gallery();const ok=await saving;busy=false;
 if(ok){selected=result.row;editor.id=selected.id;accept(editor.sections[key],selected[key]);if(create){accept(editor.sections.seo,selected.seo);for(const field of scopeFields('seo'))find('brand-'+field).value=selected.seo[field];}if(key==='basic'||key==='seo'){for(const field of scopeFields(key))find('brand-'+field).value=selected[key][field];}if(key==='basic')visibility.value=selected.basic.is_visible?'visible':'hidden';onSaved(selected);}
 status();gallery();find('brand-status').textContent=ok?(create?labels.created:labels.saved):(lastError||labels.error);
}
async function saveTranslations(field){
 const control=translationFields[field];
 if(busy||!editor.id||!can.update||!control.state.dirty())return;
 busy=true;lastError='';let result;const saving=control.state.save(async value=>{try{result=await persistTranslations(editor.id,field,Object.fromEntries(languages.map(language=>[language.code,value[language.code]??''])));}catch(error){lastError=message(error);throw error;}});
 status();gallery();const ok=await saving;busy=false;if(ok){selected=result.row;accept(control.state,overrides(selected,field));for(const input of control.inputs)input.value=overrides(selected,field)[input.dataset.translationInput]??'';onSaved(selected);}status();gallery();if(!ok)find('brand-status').textContent=lastError||labels.error;
}
dialog.querySelectorAll('[data-save]').forEach(button=>button.addEventListener('click',()=>save(button.dataset.save)));find('brand-basic-form').addEventListener('submit',event=>{event.preventDefault();save('basic');});
find('brand-seo-form').addEventListener('submit',event=>{event.preventDefault();save('seo');});
dialog.addEventListener('hide.bs.modal',event=>{if(busy){event.preventDefault();return;}if(anyDirty()&&!discard){event.preventDefault();find('brand-discard').hidden=false;find('brand-keep').focus();}});
find('brand-keep').addEventListener('click',()=>{find('brand-discard').hidden=true;});find('brand-discard-confirm').addEventListener('click',()=>{discard=true;modal.hide();});
window.addEventListener('beforeunload',event=>{if(anyDirty()){event.preventDefault();event.returnValue='';}});
dialog.addEventListener('hidden.bs.modal',()=>{editor=undefined;selected=undefined;for(const control of Object.values(translationFields))control.state=undefined;});
return {open};
}
