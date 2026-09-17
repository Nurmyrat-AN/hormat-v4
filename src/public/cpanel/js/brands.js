import {contentText} from './content/editor-state.js';
import {createContentEditor} from './content/entity-editor.js';
import {mediaPreview} from './media/preview.js';
const root=document.querySelector('#brands-page');
const initial=JSON.parse(document.querySelector('#brands-data').textContent);
let rows=initial.rows;const languages=initial.languages;let pageNumber=initial.page,total=initial.total,listSequence=0,listRequest,searchTimer,opening=false;
const can=JSON.parse(root.dataset.capabilities),labels=Object.fromEntries([...root.querySelectorAll('[data-label]')].map(el=>[el.dataset.label,el.textContent]));
const find=id=>document.getElementById(id);
const productCount=count=>labels.products+': '+count;
function render(){
 const matches=rows;
 find('brands-prev').disabled=pageNumber<=1;find('brands-next').disabled=pageNumber*9>=total;find('brands-page-number').textContent=pageNumber+' / '+Math.max(1,Math.ceil(total/9));
 const items=find('brands-items');items.replaceChildren();find('brands-empty').hidden=matches.length>0;
 for(const row of matches){const item=find('brand-template').content.firstElementChild.cloneNode(true);item.dataset.brandId=row.id;item.classList.toggle('is-hidden',!row.basic.is_visible);item.querySelector('[data-name]').textContent=contentText(row.basic.name,row.translations[document.documentElement.lang]);item.querySelector('.brand-image').append(mediaPreview(row.basic.mainMedia));item.querySelector('[data-translations]').textContent=labels.translations+': '+languages.filter(lang=>row.translations[lang.code]?.trim()).length+' / '+languages.length;item.querySelector('[data-product-count]').textContent=productCount(row.productCount);item.querySelector('[data-gallery-count]').textContent=labels.gallery+': '+row.gallery.length;item.querySelector('.brand-visibility').textContent=row.basic.is_visible?labels.visible:labels.hidden;items.append(item);}
}
function view(value){root.dataset.view=value;root.querySelectorAll('button[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===value)));try{localStorage.setItem('hormat.cpanel.brands.view',value);}catch{}}
try{view(localStorage.getItem('hormat.cpanel.brands.view')==='list'?'list':'grid');}catch{view('grid');}
root.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
find('brands-search').addEventListener('input',()=>{clearTimeout(searchTimer);listRequest?.abort();++listSequence;searchTimer=setTimeout(()=>refresh(1),300);});find('brands-filter').addEventListener('change',()=>refresh(1));
find('brands-prev').addEventListener('click',()=>refresh(pageNumber-1));find('brands-next').addEventListener('click',()=>refresh(pageNumber+1));
const errors={BRAND_INVALID_SLUG:'invalidSlug',BRAND_SLUG_TAKEN:'slugTaken',BRAND_INVALID_SEO:'invalidSeo',BRAND_FORBIDDEN:'denied',BRAND_NOT_FOUND:'notFound',BRAND_INVALID_REQUEST:'invalidRequest',BRAND_INVALID_NAME:'invalidName',BRAND_INVALID_LANGUAGE:'invalidLanguage',BRAND_INVALID_MEDIA:'invalidMedia',BRAND_DUPLICATE_MEDIA:'duplicate',BRAND_GALLERY_CONFLICT:'conflict'};
async function request(url,method='GET',body,signal){const response=await fetch(url,{method,signal,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(response.redirected||!response.ok||!data.success)throw Object.assign(Error(),{code:response.status===403?'BRAND_FORBIDDEN':data.code});return data;}
function message(error){return labels[errors[error.code]??'error'];}
async function refresh(page=pageNumber){clearTimeout(searchTimer);listRequest?.abort();listRequest=new AbortController();const generation=++listSequence;find('brands-feedback').textContent=labels.loading;try{const result=await request('/cpanel/api/brands?'+new URLSearchParams({query:find('brands-search').value.trim(),visibility:find('brands-filter').value,page:String(page)}),'GET',undefined,listRequest.signal);if(generation!==listSequence)return;rows=result.rows;pageNumber=result.page;total=result.total;render();find('brands-feedback').textContent='';}catch(error){if(error.name!=='AbortError'&&generation===listSequence)find('brands-feedback').textContent=message(error);}}

const editor=createContentEditor({kind:'brands',root,can,labels,languages,message,productsText:row=>productCount(row?.productCount??0),onSaved:()=>void refresh(),
 async persist({id,key,value,saved,create}){
  let body,method,url='/cpanel/api/brands';
  if(create){body={name:value.name};method='POST';}
  else if(key==='basic'){url+='/'+id;method='PATCH';body={};if(can.update){if(value.name!==saved.name)body.name=value.name;if((value.mainMedia?.path??null)!==(saved.mainMedia?.path??null))body.main_media_reference=value.mainMedia?.path??null;}if(can.visibility&&value.is_visible!==saved.is_visible)body.is_visible=value.is_visible;}
  else if(key==='seo'){url+='/'+id+'/seo';method='PATCH';body=Object.fromEntries(['slug','seo_title','seo_description'].filter(field=>value[field]!==saved[field]).map(field=>[field,value[field]]));}
  else{url+='/'+id+'/gallery';method='PUT';body={items:value.map(item=>item.path),original:saved.map(item=>item.path)};}
  return request(url,method,body);
 },persistTranslations:(id,field,translations)=>request('/cpanel/api/brands/'+id+'/translations','PUT',{field,translations})
});
find('brands-add')?.addEventListener('click',()=>{if(can.create&&!opening)editor.open(null);});
root.addEventListener('click',async event=>{const button=event.target.closest('[data-brand-action]');if(!button||opening)return;opening=true;find('brands-feedback').textContent=labels.loading;try{const {row}=await request('/cpanel/api/brands/'+encodeURIComponent(button.closest('[data-brand-id]').dataset.brandId));editor.open(row);if(button.dataset.brandAction==='visibility'&&can.visibility)find('brand-visibility').focus();find('brands-feedback').textContent='';}catch(error){find('brands-feedback').textContent=message(error);}finally{opening=false;}});
render();
