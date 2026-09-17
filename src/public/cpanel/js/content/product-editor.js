import {AsyncAutocomplete} from './async-autocomplete.js';
import {ContentEditorState,DraftState} from './editor-state.js';
import {TranslatableField} from './translatable-field.js';
import {MediaPicker} from '../media/picker.js';
import {mediaPreview} from '../media/preview.js';
export function createProductEditor(root){
const $=id=>document.getElementById(id),l=Object.fromEntries([...root.querySelectorAll('[data-product-label]')].map(e=>[e.dataset.productLabel,e.textContent])),caps=JSON.parse(root.dataset.capabilities);
const dialog=$('product-dialog'),modal=bootstrap.Modal.getOrCreateInstance(dialog),picker=new MediaPicker(root.querySelector('[data-media-picker]'),dialog);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='btn btn-outline-secondary btn-sm')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
let discounts=[];
const empty=()=>({basic:{name:'',source:null,brand:'',category:'',visible:false},seo:{slug:'',title:'',description:''},description:{short:'',html:''},visibility:{placement:false,showStock:false,hideStock:false},priceRules:{action:'',value:''},discounts:[],gallery:[]});

async function api(path='',body){const response=await fetch('/cpanel/api/products'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();if(!response.ok||!result.success)throw Error(result.code);return result;}
const message=error=>error.message==='PRODUCT_CONFLICT'?l.conflict:error.message==='PRODUCT_INVALID_REQUEST'?l.required:l.error;
const mediaContract=items=>items.map(m=>({path:m.path,primary:m.primary}));
let selectedSource=null;
let state,current,tab='basic',busy=false,discard=false;
const fields={name:{id:'product-name',scope:'basic',key:'name'},seo_title:{id:'product-seo-title',scope:'seo',key:'title'},seo_description:{id:'product-seo-description',scope:'seo',key:'description'},short_description:{id:'product-short-description',scope:'description',key:'short'},description:{id:'product-description',scope:'description',key:'html'}};
const sourceOf=basic=>selectedSource?.id===basic.source?selectedSource:null,draft=key=>state.sections[key].draft;
const tf=Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,new TranslatableField($(f.id).closest('[data-translatable-field]'),{onChange:renderState,onSave:async()=>{
 if(!current||!caps.update||busy)return;busy=true;renderState();const field=tf[key];
 const ok=await field.state.save(async values=>{const result=await api('/'+current.id+'/translations',{field:key==='description'?'description_html':key,translations:values});current.translations[key]=result.row.translations[key];});
 if(ok){field.reset(current.translations[key]);field.state.state='saved';}busy=false;renderState();
}})]));
for(const [key,f]of Object.entries(fields))$(f.id).addEventListener('input',()=>{if(!state)return;state.set(f.scope,{...draft(f.scope),[f.key]:$(f.id).value});renderState();});
const bindings={visible:['basic','visible'],slug:['seo','slug'],placement:['visibility','placement'],showStock:['visibility','showStock'],hideStock:['visibility','hideStock'],rule:['priceRules','action'],'rule-value':['priceRules','value']};
for(const [id,[scope,key]]of Object.entries(bindings))$('product-'+id).addEventListener('input',event=>{state.set(scope,{...draft(scope),[key]:event.target.type==='checkbox'?event.target.checked:event.target.value});renderState();});
const references={};
for(const [key,kind]of Object.entries({brand:'brands',category:'categories'})){
 const fetchOptions=async(params,signal)=>{const response=await fetch('/cpanel/api/product-references/'+kind+'?'+new URLSearchParams(params),{signal});if(!response.ok||response.redirected)throw Error();const result=await response.json();if(!result.success)throw Error();return result;};
 references[key]=new AsyncAutocomplete($('product-'+key+'-control'),{
  fetchPage:({query,page,signal})=>fetchOptions({query,page},signal),
  hydrate:async(value,signal)=>(await fetchOptions({selected:value},signal)).options[0]??null,
  onChange:option=>{if(!state)return;state.set('basic',{...draft('basic'),[key]:option?.value??''});renderState();}
 });
}
async function discountOptions(params,signal){
 const response=await fetch('/cpanel/api/products/discounts?'+new URLSearchParams({product_id:current.id,...params}),{signal});
 const data=await response.json();if(!response.ok||!data.success)throw Error();
 return {...data,options:data.rows.map(d=>({value:d.id,label:d.name,secondaryText:l.priority+' '+d.priority+' · '+(d.is_visible?l.visible:l.hidden)}))};
}
const discountControl=new AsyncAutocomplete($('product-discount-control'),{
 fetchPage:({query,page,signal})=>discountOptions({query,page},signal),
 hydrate:async(value,signal)=>(await discountOptions({selected:value},signal)).options[0]??null,
 onChange:option=>{if(option)changeDiscount('attach',option.value);}
});
discountControl.labels.empty=l.noAvailableDiscounts;
let discountNotice='';
async function changeDiscount(operation,discountId){
 if(!current||busy||!caps.update||operation==='attach'&&!caps.discountView)return;
 busy=true;discountNotice='';discountControl.close();renderState();renderDiscounts();
 try{
  const result=await api('/'+current.id+'/discounts/'+operation,{discount_id:discountId});
  discounts=result.discounts;current.discountDetails=discounts;current.discounts=discounts.map(d=>d.id);
  state.sections.discounts=new DraftState(current.discounts);
  if(operation==='attach')await discountControl.setValue('');
  discountNotice=operation==='attach'?l.discountAttached:l.discountDetached;
 }catch{discountNotice=operation==='attach'?l.discountAttachFailed:l.error;}
 finally{busy=false;renderDiscounts();renderState();if(operation==='attach')discountControl.input.focus();}
}
function dirty(){return state&&(state.anyDirty()||Object.values(tf).some(f=>f.state.dirty()));}
function editable(scope){return current?(scope==='visibility'?caps.visibility:scope==='basic'?(caps.update||caps.visibility):caps.update):scope==='basic'&&caps.create;}
function renderState(){if(!state)return;
 for(const [key,f]of Object.entries(fields)){const input=$(f.id);input.disabled=busy||!(current?caps.update:key==='name'&&caps.create);tf[key].render({base:draft(f.scope)[f.key],baseDirty:state.dirty(f.scope),locked:!current,editable:!!current&&caps.update,busy});}
 for(const [id,[scope]]of Object.entries(bindings))$('product-'+id).disabled=busy||!editable(scope)||(!current&&id!=='brand'&&id!=='category')||(id==='visible'&&!caps.visibility)||(scope==='basic'&&id!=='visible'&&current&&!caps.update);
 const source=sourceOf(draft('basic'));$('product-source-name').textContent=source?.name??'';$('product-source-name').title=source?.name??'';$('product-source-meta').textContent=source?[source.vendor,[source.price??'—',source.currency].filter(Boolean).join(' '),l.stock+': '+source.stock].filter(Boolean).join(' · '):'';
 for(const control of Object.values(references)){control.disabled=busy||!(current?caps.update:caps.create);control.input.disabled=control.disabled;control.updateClear();}
 for(const b of dialog.querySelectorAll('[data-tab]')){const active=b.dataset.tab===tab;b.disabled=busy||(!current&&b.dataset.tab!=='basic');b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;dialog.querySelector('[data-tab-state="'+b.dataset.tab+'"]').textContent=state.dirty(b.dataset.tab)?'•':'';}
 for(const p of dialog.querySelectorAll('[data-pane]'))p.hidden=p.dataset.pane!==tab;
 const save=$('product-save');save.hidden=tab==='discounts';save.textContent=busy?l.saving:!current?l.create:l.saveSection+' · '+l[tab];save.disabled=busy||!editable(tab)||(!current?false:!state.dirty(tab));
 discountControl.disabled=busy||!current||!caps.update||!caps.discountView;discountControl.input.disabled=discountControl.disabled;discountControl.updateClear();$('content-add-media').disabled=busy||!caps.update||!caps.mediaView;
 $('product-rule-value').disabled=busy||!caps.update||!draft('priceRules').action;
 const section=state.sections[tab];$('product-status').textContent=section.state==='error'?l.error:section.state==='saved'?l.saved:section.dirty()?l.dirty:!editable(tab)?l.readOnly:'';
 if(tab==='discounts')$('product-status').textContent=discountNotice||(!caps.update?l.readOnly:'');
 const flags=draft('visibility');$('product-diagnostic').replaceChildren();
 const checks=[[l.visible,draft('basic').visible],[l.vendorActive,source?.vendorActive],[l.sourceActive,source?.active],[l.stockPassed,!flags.hideStock||source?.inStock],[l.brandVisible,current?.diagnostics.brandVisible],[l.categoryVisible,current?.diagnostics.categoryVisible]];
 for(const [label,pass]of checks)$('product-diagnostic').append(el('li',(pass?'✓ ':'— ')+label,'list-group-item'));
 const price=current?.preview;$('product-price-preview').replaceChildren();for(const [label,value]of [[l.sourcePrice,source?.price==null?'—':source.price+' '+(source.currency??'')],[l.vendorRate,price?.rate??source?.rate??'1'],[l.normalized,price?.normalized??'—'],[l.normalPrice,price?.normal??'—']])$('product-price-preview').append(el('dt',label),el('dd',String(value)));
}

function open(record){discountNotice='';discountControl.setValue('');previewGeneration++;current=record??null;if(record){selectedSource=record.source;discounts=record.discountDetails;}const initial=empty();if(!record&&selectedSource)initial.basic={...initial.basic,name:selectedSource.name,source:selectedSource.id};state=new ContentEditorState(record?Object.fromEntries(['id',...Object.keys(empty())].map(k=>[k,record[k]])):initial);dialog.dataset.mode=record?'edit':'create';dialog.dataset.sourceProductId=state.sections.basic.draft.source??'';tab='basic';discard=false;$('product-discard').hidden=true;
 for(const [key,f]of Object.entries(fields)){$(f.id).value=draft(f.scope)[f.key];tf[key].reset(record?.translations[key]??{});}
 for(const [id,[scope,key]]of Object.entries(bindings)){const input=$('product-'+id);if(input.type==='checkbox')input.checked=draft(scope)[key];else input.value=draft(scope)[key];}
 for(const [key,control]of Object.entries(references)){const value=draft('basic')[key];control.setValue(/^[1-9]\d*$/.test(value??'')?value:'');}
 $('product-title').textContent=record?l.edit+' · '+record.basic.name:l.add;renderGallery();renderDiscounts();renderState();modal.show();}
async function save(){if(busy||tab==='discounts'||!editable(tab))return;
 if((!current||tab==='basic')&&!draft('basic').name.trim()){ $('product-status').textContent=l.required;return; }
 const scope=tab;previewGeneration++;clearTimeout(previewTimer);busy=true;renderState();
 if(!current){let failure='';try{const b=draft('basic');const result=await api('',{source_product_id:b.source,name:b.name,brand_id:b.brand||null,category_id:b.category||null});open(result.row);state.sections.basic.state='saved';await refreshList();}catch(error){failure=message(error);}finally{busy=false;renderState();if(failure)$('product-status').textContent=failure;}return;}
 let errorMessage='';
 const ok=await state.save(scope,async value=>{
  let body;
  if(scope==='basic'){body={};const keys={name:'name',brand:'brand_id',category:'category_id',visible:'is_visible'};for(const [key,column]of Object.entries(keys))if(value[key]!==state.sections.basic.saved[key])body[column]=['brand','category'].includes(key)?value[key]||null:value[key];}
  else if(scope==='seo')body={slug:value.slug||null,seo_title:value.title,seo_description:value.description};
  else if(scope==='description')body={short_description:value.short,description_html:value.html};
  else if(scope==='visibility')body={is_placement_product:value.placement,show_as_in_stock:value.showStock,hide_when_out_of_stock:value.hideStock};
  else if(scope==='priceRules')body={price_action:value.action||null,price_value:value.action?value.value:null};
  else if(scope==='gallery')body={items:mediaContract(value),original:mediaContract(state.sections.gallery.saved)};
  try{const result=await api('/'+current.id+'/'+scope,body);current[scope]=result.row[scope];current.preview=result.row.preview;current.diagnostics=result.row.diagnostics;current.source=result.row.source;selectedSource=result.row.source;}catch(e){errorMessage=message(e);throw e;}
 });
 busy=false;
 if(ok){state.sections[scope]=new DraftState(current[scope]);state.sections[scope].state='saved';for(const f of Object.values(fields))if(f.scope===scope)$(f.id).value=draft(scope)[f.key];for(const [id,[bindingScope,key]]of Object.entries(bindings))if(bindingScope===scope){const input=$('product-'+id);if(input.type==='checkbox')input.checked=draft(scope)[key];else input.value=draft(scope)[key];}renderGallery();renderDiscounts();await refreshList();}
 renderState();if(scope!=='priceRules'&&state.dirty('priceRules'))requestPreview();if(errorMessage)$('product-status').textContent=errorMessage;
}
let previewTimer,previewGeneration=0;
function requestPreview(){clearTimeout(previewTimer);const generation=++previewGeneration;if(!current)return;previewTimer=setTimeout(async()=>{try{const rule=draft('priceRules'),result=await api('/'+current.id+'/preview',{price_action:rule.action||null,price_value:rule.action?rule.value:null});if(generation===previewGeneration){current.preview=result.preview;renderState();}}catch{if(generation===previewGeneration){current.preview={rate:selectedSource?.rate??'1',normal:null,normalized:null};renderState();}}},300);}
$('product-rule').addEventListener('input',requestPreview);$('product-rule-value').addEventListener('input',requestPreview);
function renderDiscounts(){const box=$('product-discounts');box.replaceChildren();const selected=discounts.filter(d=>draft('discounts').includes(d.id)).sort((a,b)=>b.priority-a.priority||(BigInt(a.id)<BigInt(b.id)?-1:1));if(!selected.length)box.append(el('p',l.discountEmpty,'text-body-secondary'));for(const d of selected){const row=el('article',undefined,'border rounded p-3 mb-2');row.append(el('h3',d.name,'fs-6'),el('p',`${l.priority}: ${d.priority} · ${l.before}: ${l[d.before_action]} ${d.before_value??'—'} · ${l.after}: ${l[d.after_action]} ${d.after_value??'—'}`,'mb-1'),el('p',`${d.starts_at??'—'} — ${d.ends_at??'—'} · ${d.is_visible?l.visible:l.hidden} · ${l.showName}: ${d.is_visible_on_product?'✓':'—'}`,'small text-body-secondary'));const menu=el('div',undefined,'dropdown');const toggle=button('⋮',()=>{});toggle.dataset.bsToggle='dropdown';toggle.setAttribute('aria-label',l.actions);toggle.disabled=busy||!caps.update;const items=el('div',undefined,'dropdown-menu dropdown-menu-end');const b=button(l.detach,()=>changeDiscount('detach',d.id),'dropdown-item');b.disabled=busy||!caps.update;items.append(b);menu.append(toggle,items);row.append(menu);box.append(row);}}
function renderGallery(){const box=$('content-gallery');box.replaceChildren();const gallery=draft('gallery');$('content-gallery-empty').hidden=gallery.length>0;$('product-no-primary').hidden=gallery.some(m=>m.primary);gallery.forEach((m,i)=>{const card=el('article',undefined,'gallery-card');card.append(mediaPreview(m),el('p',m.name,'small text-truncate mb-1'));if(m.primary)card.append(el('span',l.primary,'badge text-bg-success'));const menu=el('div',undefined,'dropdown');const toggle=button('⋮',()=>{},'btn btn-sm btn-outline-secondary');toggle.dataset.bsToggle='dropdown';toggle.setAttribute('aria-label',l.actions);toggle.disabled=!caps.update||busy;const list=el('div',undefined,'dropdown-menu dropdown-menu-end');const action=(label,fn,disabled=false)=>{const b=button(label,()=>{fn();renderGallery();renderState();},'dropdown-item');b.disabled=disabled;list.append(b);};if(!m.primary)action(l.setPrimary,()=>state.set('gallery',gallery.map(x=>({...x,primary:x.path===m.path}))));action(l.earlier,()=>{const a=[...gallery];[a[i-1],a[i]]=[a[i],a[i-1]];state.set('gallery',a);},i===0);action(l.later,()=>{const a=[...gallery];[a[i+1],a[i]]=[a[i],a[i+1]];state.set('gallery',a);},i===gallery.length-1);action(l.remove,()=>state.set('gallery',gallery.filter(x=>x.path!==m.path)));menu.append(toggle,list);card.append(menu);box.append(card);});}
async function refreshList(){root.dispatchEvent(new CustomEvent('product-saved'));}
$('product-save').addEventListener('click',save);dialog.querySelectorAll('[data-tab]').forEach(b=>{b.addEventListener('click',()=>{tab=b.dataset.tab;renderState();});b.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...dialog.querySelectorAll('[data-tab]')].filter(x=>!x.disabled),i=tabs.indexOf(b),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();tabs[next].focus();});});
$('content-add-media').addEventListener('click',event=>picker.open({mode:'multiple',mediaType:'image',permanentOnly:true,exclude:draft('gallery').map(m=>m.path),initialSelection:[],trigger:event.currentTarget,onSelect:items=>{state.set('gallery',[...draft('gallery'),...items.filter(m=>!draft('gallery').some(x=>x.path===m.path)).map(m=>({...m,primary:false}))]);renderGallery();renderState();}}));
dialog.addEventListener('hide.bs.modal',event=>{if(picker.active||event.defaultPrevented)return;if(busy||(!discard&&dirty())){event.preventDefault();if(!busy)$('product-discard').hidden=false;}});$('product-keep').addEventListener('click',()=>$('product-discard').hidden=true);$('product-discard-confirm').addEventListener('click',()=>{discard=true;modal.hide();});window.addEventListener('beforeunload',event=>{if(dialog.classList.contains('show')&&dirty()){event.preventDefault();event.returnValue='';}});
dialog.addEventListener('hidden.bs.modal',()=>{discountControl.close();for(const control of Object.values(references))control.close();});
return {labels:l,async openEdit(id){if(!caps.update)return false;try{open((await api('/'+id)).row);return true;}catch{return false;}},async openCreate(source){if(!caps.create||!source?.id)return;try{selectedSource=(await api('/source/'+source.id)).source;open(null);}catch{selectedSource={id:source.id,name:source.name,vendor:source.vendor.name,price:source.price,currency:source.currency?.name??'',stock:source.stock,active:source.is_active,rate:null,vendorActive:null};open(null);$('product-status').textContent=l.error;}}};
}
