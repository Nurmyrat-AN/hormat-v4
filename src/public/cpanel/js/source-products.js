import {AsyncAutocomplete} from './content/async-autocomplete.js';
import {initialQuery,clearFilters,activeFilterCount} from './source-products/query.js';


const root=document.querySelector('#source-products-page');
const find=id=>document.getElementById('source-'+id);
const labels=Object.fromEntries([...root.querySelectorAll('[data-source-label]')].map(item=>[item.dataset.sourceLabel,item.textContent]));
let rows=[],total=0,request,revision=0,detailRequest;const autocompletes={};
let query=initialQuery(),page=1,timer,activeTab='basic';
const pageSize=12,dialog=find('dialog'),modal=bootstrap.Modal.getOrCreateInstance(dialog);
const node=(tag,text,className)=>{const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;};
const display=value=>value===null||value===undefined||value===''?labels.emptyValue:String(value);
const filterLabel=key=>key.startsWith('property_')?labels['property'+key.slice(-1)]:labels[{active:'status',connection:'connection'}[key]??key];
function option(key,value,label){find('filter-'+key).append(new Option(label,value));}
async function api(url,signal){const response=await fetch(url,{signal});if(!response.ok||response.redirected)throw Error();const data=await response.json();if(!data.success)throw Error();return data;}
for(const kind of ['vendor','currency','measure']){
 const fetchOptions=async(parameters,signal)=>{const params=new URLSearchParams({kind,...parameters});if(kind!=='vendor'&&query.filters.vendor)params.set('vendor',query.filters.vendor);return api('/cpanel/api/source-products/options?'+params,signal);};
 autocompletes[kind]=new AsyncAutocomplete(find('filter-'+kind+'-control'),{
  fetchPage:({query,page,signal})=>fetchOptions({query,page:String(page)},signal),
  hydrate:async(value,signal)=>(await fetchOptions({selected:value},signal)).options[0]??null,
  onHydrate:()=>renderFilters(),
  onChange:option=>{query.filters[kind]=option?.value??'';if(kind==='vendor'){for(const key of ['currency','measure']){query.filters[key]='';autocompletes[key].setValue('');}}refresh();}
 });
}
function hydrateOptions(){for(const [kind,control]of Object.entries(autocompletes))control.setValue(query.filters[kind]);}
for(const [key,items]of Object.entries({active:[['active',labels.active],['inactive',labels.inactive]],stock:[['in',labels.inStock],['out',labels.outStock]],connection:[['has',labels.hasProduct],['none',labels.noProduct]]}))for(const [value,label]of items)option(key,value,label);

function setView(value){
 root.dataset.view=value;find('list-head').hidden=value!=='list';
 root.querySelectorAll('[data-source-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sourceView===value)));
 try{localStorage.setItem('hormat.cpanel.source-products.view',value);}catch{}
}
let initialView='grid';try{if(localStorage.getItem('hormat.cpanel.source-products.view')==='list')initialView='list';}catch{}setView(initialView);
root.querySelectorAll('[data-source-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.sourceView)));
find('filters-toggle').addEventListener('click',()=>{const hidden=!find('filters').hidden;find('filters').hidden=hidden;find('filters-toggle').setAttribute('aria-expanded',String(!hidden));});
function params(){const result=new URLSearchParams({field:query.field,query:query.query,page:String(page),sort:query.sort||'name'});for(const [k,v]of Object.entries(query.filters))if(v)result.set(k,v);return result;}
function hydrate(){const p=new URLSearchParams(location.search);query=initialQuery();query.field=p.get('field')||'name';query.sort=p.get('sort')||'name';query.query=p.get('query')||'';for(const key of Object.keys(query.filters))query.filters[key]=p.get(key)||'';page=Number(p.get('page')||1);find('search').value=query.query;find('search-field').value=query.field;root.querySelectorAll('[data-source-filter]').forEach(input=>input.value=query.filters[input.dataset.sourceFilter]);}
async function load(historyMode='push'){
 clearTimeout(timer);request?.abort();request=new AbortController();const current=++revision;find('results').setAttribute('aria-busy','true');find('feedback').textContent=labels.loading;
 try{const data=await api('/cpanel/api/source-products?'+params(),request.signal);if(current!==revision)return;rows=data.rows;total=data.total;page=data.page;render();find('feedback').textContent='';const url=location.pathname+'?'+params();if(historyMode==='push'&&url!==location.pathname+location.search)history.pushState(null,'',url);else if(historyMode==='replace')history.replaceState(null,'',url);}
 catch(error){if(error.name==='AbortError'||current!==revision)return;rows=[];total=0;render();find('feedback').textContent=labels.failed;}
 finally{if(current===revision)find('results').removeAttribute('aria-busy');}
}
function refresh(){page=1;load();}
function debounce(){clearTimeout(timer);request?.abort();++revision;timer=setTimeout(refresh,300);}
find('search').addEventListener('input',()=>{query.query=find('search').value;debounce();});
find('search-field').addEventListener('change',()=>{query.field=find('search-field').value;refresh();});
for(const input of root.querySelectorAll('[data-source-filter]'))input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{
 const key=input.dataset.sourceFilter;
 query.filters[key]=input.value;
 if(input.tagName==='SELECT')refresh();else debounce();
});
find('clear').addEventListener('click',()=>{query=clearFilters(query);root.querySelectorAll('[data-source-filter]').forEach(input=>input.value='');hydrateOptions();refresh();});
find('prev').addEventListener('click',()=>{page--;load();});find('next').addEventListener('click',()=>{page++;load();});
window.addEventListener('popstate',()=>{hydrate();hydrateOptions();load('none');});
function renderFilters(){
 const count=activeFilterCount(query);find('filter-count').textContent=count?'('+count+')':'';find('clear').disabled=!count;find('filters-toggle').classList.toggle('filters-active',count>0);
 const propertyCount=Object.entries(query.filters).filter(([key,value])=>key.startsWith('property_')&&value.trim()).length;find('property-count').textContent=propertyCount?'('+propertyCount+')':'';
 const container=find('active-filters');container.replaceChildren();container.hidden=!count;
 for(const [key,value]of Object.entries(query.filters)){if(!value.trim())continue;const input=find('filter-'+key),shown=input.tagName==='SELECT'?(input.selectedOptions[0]?.textContent||'#'+value):(autocompletes[key]?autocompletes[key].selected?.label||(autocompletes[key].hydrationFailed?labels.failed:labels.loading):value);
  const chip=node('span',filterLabel(key)+': '+shown,'source-filter-chip');container.append(chip);
 }
}
function render(){
 const pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(Math.max(page,1),pages);
 find('results-count').textContent=String(total);find('page').textContent=page+' / '+pages;find('prev').disabled=page===1;find('next').disabled=page===pages;find('empty').hidden=total>0;
 const results=find('results');results.replaceChildren();
 for(const row of rows){
  const card=node('article',undefined,'source-card'+(row.is_active?'':' is-inactive'));card.dataset.sourceId=row.source_id;card.setAttribute('aria-labelledby','source-name-'+row.id);
  const identity=node('div',undefined,'source-cell source-identity');const title=node('button',row.name,'source-name');title.type='button';title.id='source-name-'+row.id;title.addEventListener('click',()=>openDetails(row));identity.append(title);card.append(identity);
  const values={vendor:row.vendor.name,sourceId:row.source_id,price:display(row.price),currency:display(row.currency?.name),measure:display(row.measure?.name),stock:row.stock,status:row.is_active?labels.active:labels.inactive,products:row.product_count};
  for(const [key,value]of Object.entries(values)){
   const cell=node('div',undefined,'source-cell source-'+key);cell.append(node('span',labels[key],'source-cell-label'));
   if(key==='status')cell.append(node('span',String(value),'badge source-status '+(row.is_active?'text-success-emphasis bg-success-subtle':'text-body-secondary bg-body-secondary')));
   else if(key==='stock'){cell.append(node('strong',String(value)),node('small',Number(row.stock)>0?labels.inStock:labels.outStock,'badge source-stock-state '+(Number(row.stock)>0?'text-success-emphasis bg-success-subtle':'text-body-secondary bg-body-secondary')));}
   else if(key==='products')cell.append(node('span',row.product_count?labels.hasProduct+' · '+row.product_count:labels.noProduct,'badge source-connection '+(row.product_count?'text-primary-emphasis bg-primary-subtle':'text-body-secondary bg-body-secondary')));
   else cell.append(node('span',String(value)));card.append(cell);
  }
  const actions=node('div',undefined,'source-cell source-actions');const details=node('button',labels.details,'btn btn-sm btn-outline-secondary');details.type='button';details.dataset.sourceDetails=row.id;details.addEventListener('click',()=>openDetails(row));actions.append(details);card.append(actions);
  const barcodes=node('p',labels.barcodes+': '+row.barcode_count+(row.barcode_preview?' · '+row.barcode_preview:''),'source-barcode-summary small text-body-secondary mb-0');barcodes.title=row.barcode_preview||'';card.append(barcodes);results.append(card);
 }
 renderFilters();
}
function definitionList(entries){const list=node('dl',undefined,'source-details');for(const [key,value]of entries)list.append(node('dt',key),node('dd',display(value)));return list;}
function showTab(key){
 activeTab=key;for(const button of dialog.querySelectorAll('[data-source-tab]')){const active=button.dataset.sourceTab===key;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
 dialog.querySelectorAll('[data-source-pane]').forEach(pane=>pane.hidden=pane.dataset.sourcePane!==key);
}
async function openDetails(summary){
 detailRequest?.abort();const active=new AbortController();detailRequest=active;
 find('dialog-title').textContent=summary.name;dialog.querySelectorAll('[data-source-pane]').forEach(pane=>pane.replaceChildren());find('detail-feedback').textContent=labels.loading;showTab('basic');modal.show();
 let row;try{row=(await api('/cpanel/api/source-products/'+summary.id,active.signal)).row;if(detailRequest!==active)return;find('detail-feedback').textContent='';}catch(error){if(error.name!=='AbortError'&&detailRequest===active)find('detail-feedback').textContent=labels.failed;return;}

 find('dialog-title').textContent=row.name;
 find('pane-basic').replaceChildren(definitionList([[labels.name,row.name],[labels.vendor,row.vendor.name],[labels.sourceId,row.source_id],[labels.price,row.price],[labels.currency,row.currency?.name],[labels.measure,row.measure?.name],[labels.status,row.is_active?labels.active:labels.inactive]]));
 const stock=find('pane-stock');stock.replaceChildren(node('p',labels.stockHelp,'text-body-secondary small'),definitionList([[labels.stock,row.stock]]));
 if(row.stocks.length){const table=node('table',undefined,'table align-middle');const head=node('thead'),header=node('tr');for(const label of [labels.warehouse,labels.stock]){const th=node('th',label);th.scope='col';header.append(th);}head.append(header);const body=node('tbody');for(const item of row.stocks){const tr=node('tr');tr.append(node('td',item.warehouse),node('td',item.stock));body.append(tr);}table.append(head,body);stock.append(table);}else stock.append(node('p',labels.noStock));
 const barcodes=find('pane-barcodes');barcodes.replaceChildren();if(!row.barcodes.length)barcodes.append(node('p',labels.noBarcodes,'text-body-secondary'));else{const list=node('ul',undefined,'list-group');for(const barcode of row.barcodes)list.append(node('li',barcode,'list-group-item font-monospace'));barcodes.append(list);}
 find('pane-properties').replaceChildren(definitionList([1,2,3,4,5].map(n=>[labels['property'+n],row['property_'+n]])));
 find('pane-products').replaceChildren(definitionList([[labels.connected,row.product_count]]),node('p',labels.productsHelp,'text-body-secondary'));
 showTab('basic');
}
for(const button of dialog.querySelectorAll('[data-source-tab]')){
 button.addEventListener('click',()=>showTab(button.dataset.sourceTab));
 button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...dialog.querySelectorAll('[data-source-tab]')],index=tabs.indexOf(button),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showTab(tabs[next].dataset.sourceTab);tabs[next].focus();});
}
dialog.addEventListener('hidden.bs.modal',()=>{detailRequest?.abort();detailRequest=null;});
hydrate();hydrateOptions();load('replace');
