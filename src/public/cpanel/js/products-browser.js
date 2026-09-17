import {AsyncAutocomplete} from './content/async-autocomplete.js';
import {mediaPreview} from './media/preview.js';
export function productsBrowser(root,editor){
 const $=id=>document.getElementById(id),labels={...editor.labels,...Object.fromEntries([...root.querySelectorAll('[data-browser-label]')].map(e=>[e.dataset.browserLabel,e.textContent]))},caps=JSON.parse(root.dataset.capabilities),box=$('products-results');
 const keys=['vendor','brand','category','discount','visibility','storefront','stock','showStock','hideStock','placement'];
 let state={},view='grid',rows=[],currency=null,controller,generation=0,timer;const controls={};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn,cls='dropdown-item')=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 async function request(path,options={}){const r=await fetch('/cpanel/api/products'+path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf,...options.headers}});if(!r.ok)throw Error();return r.json();}
 function params(){const p=new URLSearchParams();for(const [k,v]of Object.entries(state))if(v)p.set(k,v);return p;}
 function url(mode){const p=params();p.set('view',view);history[mode+'State']({},'',location.pathname+'?'+p);}
 function restore(){const p=new URLSearchParams(location.search);state={field:p.get('field')||'name',query:p.get('query')||'',page:p.get('page')||'1'};for(const key of keys)state[key]=p.get(key)||'';view=p.get('view')==='list'?'list':'grid';$('products-field').value=state.field;$('products-query').value=state.query;for(const input of root.querySelectorAll('[data-product-filter]'))input.value=state[input.dataset.productFilter];for(const [key,control]of Object.entries(controls)){const special=['none','has'].includes(state[key]);control.setValue(special?'':state[key]);const select=root.querySelector(`[data-presence="${key}"]`);if(select)select.value=special?state[key]:'';}if(keys.some(k=>state[k])){ $('products-filters').hidden=false;$('products-filters-toggle').setAttribute('aria-expanded','true');}}
 async function load(mode){clearTimeout(timer);controller?.abort();controller=new AbortController();const current=++generation;if(mode)url(mode);$('products-feedback').textContent=labels.loading;box.setAttribute('aria-busy','true');$('products-prev').disabled=true;$('products-next').disabled=true;
  $('products-filter-count').textContent=keys.filter(k=>state[k]).length?'('+keys.filter(k=>state[k]).length+')':'';
  try{const result=await request('?'+params(),{signal:controller.signal});if(current!==generation)return;rows=result.rows;currency=result.currency;render();$('products-feedback').textContent=labels.count.replace('{count}',result.total);$('products-page').textContent=result.page+' / '+Math.max(1,Math.ceil(result.total/20));$('products-prev').disabled=result.page<=1;$('products-next').disabled=!result.hasMore;}
  catch(e){if(e.name!=='AbortError'&&current===generation){rows=[];render();$('products-feedback').textContent=labels.error;}}
  finally{if(current===generation)box.removeAttribute('aria-busy');}
 }
 function change(key,value){state[key]=value;state.page='1';load('push');}
 function render(){box.dataset.view=view;box.replaceChildren();root.querySelectorAll('[data-products-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.productsView===view)));$('products-empty').hidden=rows.length>0;
  for(const p of rows){const card=el('article',undefined,'product-card'+(p.is_visible?'':' is-hidden'));card.dataset.productId=p.id;const image=mediaPreview(p.image);image.classList.add('product-browser-image');card.append(image);
   const body=el('div',undefined,'product-card-content');body.append(el('h2',p.effective_name,'fs-6 mb-2 browser-name'),el('p',(p.brand||labels.noBrand)+' · '+(p.category||labels.noCategory),'small text-body-secondary mb-1 browser-taxonomy'),el('p',p.source_name+' · '+p.vendor,'small text-body-secondary mb-2 browser-source'));
   body.append(el('p',(p.price??'—')+' '+(currency?.code??labels.units),'product-browser-price fw-semibold mb-2'));
   const states=el('div',undefined,'d-flex flex-wrap gap-2 browser-states');states.append(el('span',(Number(p.stock)>0?labels.inStock:labels.outStock)+' · '+p.stock,'badge '+(Number(p.stock)>0?'text-bg-success':'text-bg-secondary')),el('span',p.is_visible?labels.visible:labels.hidden,'badge '+(p.is_visible?'text-bg-light border':'text-bg-secondary')));body.append(states);
   if(!p.effective_visible){const reason=!p.vendor_active?labels.vendor+': '+labels.inactive:!p.source_active?labels.source+': '+labels.inactive:!p.brand_visible?labels.brand+': '+labels.hidden:!p.category_visible?labels.category+': '+labels.hidden:Number(p.stock)<=0&&p.hide_when_out_of_stock?labels.outStock:labels.effectiveHidden;body.append(el('p',reason,'small text-body-secondary mt-1 mb-0 browser-reason'));}
   if(p.show_as_in_stock)body.append(el('p',labels.showStockHelp,'small text-body-secondary mb-0 browser-stock-help'));
   body.append(el('p',labels.discounts+': '+p.discount_count,'small text-body-secondary mt-1 mb-0 browser-discounts'));card.append(body);
   if(caps.update||caps.visibility){const menu=el('div',undefined,'dropdown');const toggle=button('⋮',()=>{},'btn btn-sm btn-outline-secondary');toggle.dataset.bsToggle='dropdown';toggle.setAttribute('aria-label',labels.actions);const items=el('div',undefined,'dropdown-menu dropdown-menu-end');if(caps.update){const edit=button(labels.editAction,async()=>{if(!await editor.openEdit(p.id))$('products-feedback').textContent=labels.error;});edit.dataset.productEdit=p.id;items.append(edit);}if(caps.visibility)items.append(button(labels.changeVisibility,async()=>{toggle.disabled=true;try{await request('/'+p.id+'/basic',{method:'POST',body:JSON.stringify({is_visible:!p.is_visible})});await load();}catch{$('products-feedback').textContent=labels.error;}finally{toggle.disabled=false;}}));menu.append(toggle,items);card.append(menu);}box.append(card);
  }
 }
 for(const [key,kind]of [['vendor','vendors'],['brand','brands'],['category','categories'],['discount','discounts']]){
  controls[key]=new AsyncAutocomplete($('products-filter-'+key+'-control'),{fetchPage:({query,page,signal})=>request('/browser-lookups/'+kind+'?'+new URLSearchParams({query,page}),{signal}),hydrate:async(value,signal)=>(await request('/browser-lookups/'+kind+'?selected='+encodeURIComponent(value),{signal})).options[0]??null,onChange:option=>{const select=root.querySelector(`[data-presence="${key}"]`);if(select)select.value='';change(key,option?.value||'');}});
 }
 root.querySelectorAll('[data-presence]').forEach(select=>select.addEventListener('change',()=>{const key=select.dataset.presence;controls[key].setValue('');change(key,select.value);}));
 root.querySelectorAll('[data-product-filter]').forEach(select=>select.addEventListener('change',()=>change(select.dataset.productFilter,select.value)));
 $('products-query').addEventListener('input',()=>{clearTimeout(timer);controller?.abort();++generation;state.query=$('products-query').value;state.page='1';timer=setTimeout(()=>load('push'),300);});$('products-field').addEventListener('change',()=>change('field',$('products-field').value));
 $('products-clear').addEventListener('click',()=>{for(const key of keys)state[key]='';for(const control of Object.values(controls))control.setValue('');root.querySelectorAll('[data-product-filter],[data-presence]').forEach(s=>s.value='');state.page='1';load('push');});
 $('products-filters-toggle').addEventListener('click',()=>{const panel=$('products-filters');panel.hidden=!panel.hidden;$('products-filters-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
 root.querySelectorAll('[data-products-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.productsView;url('push');render();}));
 $('products-prev').addEventListener('click',()=>{state.page=String(Math.max(1,Number(state.page)-1));load('push');});$('products-next').addEventListener('click',()=>{state.page=String(Number(state.page)+1);load('push');});
 window.addEventListener('popstate',()=>{restore();load();});root.addEventListener('product-saved',()=>load());restore();load();
}
