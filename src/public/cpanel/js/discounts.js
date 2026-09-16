import {DraftState} from './content/editor-state.js';
import {TranslatableField} from './content/translatable-field.js';

const root=document.querySelector('#discounts-page');
if(root){
 const find=selector=>root.querySelector(selector),all=selector=>[...root.querySelectorAll(selector)];
 const can=JSON.parse(root.dataset.capabilities),labels=Object.fromEntries(all('[data-label]').map(el=>[el.dataset.label,el.textContent]));
 const initial=JSON.parse(find('#discount-data').textContent);
 function localTime(value){if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,23);}
 function prepare(row){return {...row,basic:{...row.basic,starts_at:localTime(row.basic.starts_at),ends_at:localTime(row.basic.ends_at)},rules:Object.fromEntries(Object.entries(row.rules).map(([side,rule])=>[side,{...rule,value:rule.value??''}]))};}
 let rows=initial.rows.map(prepare),pageNumber=initial.page,total=initial.total,generation=0,searchTimer;
 function message(error){return error?.code==='DISCOUNT_FORBIDDEN'?labels.denied:error?.code==='DISCOUNT_NOT_FOUND'?labels.notFound:error?.code==='DISCOUNT_INVALID_LANGUAGE'?labels.invalidLanguage:error?.code==='DISCOUNT_INVALID_RULE'?labels.invalidRule:error?.code?.startsWith('DISCOUNT_INVALID_')?labels.invalid:labels.error;}
 async function api(method,path,body){const response=await fetch('/cpanel/api/discounts'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw Object.assign(new Error(),{code:data.code??(response.status===403?'DISCOUNT_FORBIDDEN':'DISCOUNT_SAVE_FAILED')});return data;}
 async function refresh(){const version=++generation;try{const data=await api('GET','?'+new URLSearchParams({query:find('#discount-search').value,visibility:find('#discount-filter').value,page:String(pageNumber)}));if(version!==generation)return;rows=data.rows.map(prepare);pageNumber=data.page;total=data.total;renderList();}catch(error){if(version===generation)find('#discount-feedback').textContent=message(error);}}
 async function edit(row,button){button.disabled=true;try{open(prepare((await api('GET','/'+row.id)).row));}catch(error){find('#discount-feedback').textContent=message(error);}finally{button.disabled=false;}}
 let current=null,basic,rules,tab='basic',allowClose=false,busy=false;
 const modalElement=find('#discount-dialog'),modal=bootstrap.Modal.getOrCreateInstance(modalElement);
 const field=new TranslatableField(find('[data-translatable-field]'),{onChange:renderEditor,onSave:async()=>{
  if(!current||!can.update||busy)return;
  await persist(field.state,'translations',value=>({translations:value}));
 }});
 function preview(rule){return labels[rule.action]+' '+(rule.value||'—')+(rule.value&&rule.action.endsWith('Percent')?'%':'');}
 const locale=document.documentElement.lang==='tm'?'tk':document.documentElement.lang;
 function date(value,empty){return value?new Date(value).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'}):labels[empty];}
 function renderList(){
  const matches=rows;
  find('#discount-prev').disabled=pageNumber<=1;find('#discount-next').disabled=pageNumber*initial.pageSize>=total;find('#discount-page-number').textContent=pageNumber+' / '+Math.max(1,Math.ceil(total/initial.pageSize));
  find('#discount-items').replaceChildren();find('#discount-empty').hidden=matches.length>0;
  for(const row of matches){const item=find('#discount-card').content.firstElementChild.cloneNode(true);item.dataset.discountId=row.id;
   item.classList.toggle('is-hidden',!row.basic.visible);
   item.querySelector('[data-name]').textContent=row.basic.name;
   item.querySelector('[data-priority]').textContent=labels.priority+': '+row.basic.priority;
   item.querySelector('[data-before]').textContent=labels.before+': '+preview(row.rules.before);
   item.querySelector('[data-after]').textContent=labels.after+': '+preview(row.rules.after);
   item.querySelector('[data-dates]').textContent=date(row.basic.starts_at,'noStart')+' → '+date(row.basic.ends_at,'noEnd');
   item.querySelector('[data-products]').textContent=labels.products+': '+row.productCount.toLocaleString(locale);
   const badge=item.querySelector('[data-visibility]');badge.textContent=row.basic.visible?labels.visible:labels.hidden;badge.classList.add(row.basic.visible?'text-bg-success':'text-bg-secondary');
   item.querySelector('[data-action=edit]').addEventListener('click',event=>edit(row,event.currentTarget));
   item.querySelector('[data-action=visibility]')?.addEventListener('click',async event=>{if(!can.visibility)return;const button=event.currentTarget;button.disabled=true;try{await api('PATCH','/'+row.id,{is_visible:!row.basic.visible});find('#discount-feedback').textContent=labels.saved;await refresh();}catch(error){find('#discount-feedback').textContent=message(error);}finally{button.disabled=false;}});
   find('#discount-items').append(item);
  }
 }
 function selectTab(next){if(!current&&next!=='basic')return;tab=next;all('[data-tab]').forEach(button=>{const active=button.dataset.tab===next;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});all('[data-pane]').forEach(pane=>pane.hidden=pane.dataset.pane!==next);for(const scope of ['basic','rules'])find('#discount-save-'+scope).hidden=scope!==next;}
 function renderEditor(){
  if(!basic)return;
  const create=!current,editable=create?can.create:can.update;
  find('#discount-title').textContent=create?labels.create:labels.edit+' · '+current.basic.name;
  modalElement.dataset.entityId=current?.id??'';
  find('#discount-edit-fields').hidden=create;find('#discount-locked').hidden=!create;
  find('#discount-show-name').disabled=create||!editable||busy;find('#discount-name').disabled=!editable||busy;find('#discount-priority').disabled=!editable||busy;
  find('#discount-visibility').disabled=create||!can.visibility||busy;
  for(const key of ['starts_at','ends_at']){find('#discount-'+key).disabled=!editable||busy||find('#discount-no-'+key).checked;find('#discount-no-'+key).disabled=!editable||busy;}
  all('[data-tab]').forEach(button=>button.disabled=busy||(create&&button.dataset.tab!=='basic'));
  field.render({base:basic.draft.name,baseDirty:basic.saved.name!==basic.draft.name,locked:create,editable:can.update,busy});
  for(const side of ['before','after']){
   const rule=rules.draft[side];find('#discount-'+side+'-action').disabled=create||!can.update||busy;find('#discount-'+side+'-value').disabled=create||!can.update||busy;
   find('[data-value-label='+side+']').textContent=rule.action.endsWith('Percent')?labels.percent:rule.action==='fixed'?labels.fixedValue:labels.amount;
   find('[data-preview='+side+']').textContent=preview(rule);
  }
  for(const [scope,state] of Object.entries({basic,rules}))find('[data-state='+scope+']').textContent=state.dirty()?labels.dirty:state.state==='saved'?labels.saved:'';
  find('#discount-save-basic').textContent=create?labels.create:labels.basicSave;
  find('#discount-save-basic').disabled=busy||(!create&&!basic.dirty())||!(editable||(!create&&can.visibility));
  find('#discount-save-rules').disabled=create||busy||!can.update||!rules.dirty();
  find('#discount-product-count').textContent=labels.products+': '+(current?.productCount??0).toLocaleString(locale);
 }
 function open(row){
  current=row;allowClose=false;busy=false;basic=new DraftState(row?.basic??{name:'',priority:'0',visible:false,isVisibleOnProduct:false,starts_at:'',ends_at:''});
  rules=new DraftState(row?.rules??{before:{action:'removePercent',value:''},after:{action:'removeAmount',value:''}});field.reset(row?.translations??{});
  find('#discount-show-name').checked=basic.draft.isVisibleOnProduct;find('#discount-name').value=basic.draft.name;find('#discount-name').maxLength=200;find('#discount-priority').value=basic.draft.priority;find('#discount-visibility').value=basic.draft.visible?'visible':'hidden';
  for(const key of ['starts_at','ends_at']){find('#discount-'+key).value=basic.draft[key];find('#discount-no-'+key).checked=!basic.draft[key];}
  for(const side of ['before','after']){find('#discount-'+side+'-action').value=rules.draft[side].action;find('#discount-'+side+'-value').value=rules.draft[side].value;}
  find('#discount-status').textContent=(row&&!can.update&&!can.visibility)?labels.readOnly:'';find('#discount-discard').hidden=true;
  selectTab('basic');renderEditor();modal.show();
 }
 function readBasic(){
  basic.set({name:find('#discount-name').value,priority:find('#discount-priority').value,visible:current?find('#discount-visibility').value==='visible':false,
   isVisibleOnProduct:find('#discount-show-name').checked,starts_at:current&&!find('#discount-no-starts_at').checked?find('#discount-starts_at').value:'',ends_at:current&&!find('#discount-no-ends_at').checked?find('#discount-ends_at').value:''});renderEditor();
 }
 find('#discount-basic-form').addEventListener('input',event=>{if(!event.target.matches('[data-translation-input]'))readBasic();});
 for(const key of ['starts_at','ends_at'])find('#discount-no-'+key).addEventListener('change',()=>{if(find('#discount-no-'+key).checked)find('#discount-'+key).value='';readBasic();});
 find('#discount-rules-form').addEventListener('input',()=>{rules.set(Object.fromEntries(['before','after'].map(side=>[side,{action:find('#discount-'+side+'-action').value,value:find('#discount-'+side+'-value').value}])));renderEditor();});
 find('#discount-basic-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||find('#discount-save-basic').disabled)return;
  readBasic();const value=basic.draft;
  const invalidDate=['starts_at','ends_at'].some(key=>current&&!find('#discount-no-'+key).checked&&!value[key]);
  if(!value.name.trim()||!value.priority.trim()||!Number.isSafeInteger(Number(value.priority))||invalidDate||(value.starts_at&&value.ends_at&&value.ends_at<value.starts_at)){find('#discount-status').textContent=labels.invalid;return;}
  basic.set({...value,name:value.name.trim(),priority:String(Number(value.priority))});find('#discount-name').value=basic.draft.name;
  const creating=!current;
  const mapping={name:'name',priority:'priority',visible:'is_visible',isVisibleOnProduct:'is_visible_on_product',starts_at:'starts_at',ends_at:'ends_at'};
  await persist(basic,creating?'create':'basic',saved=>{
   if(creating)return {name:saved.name,priority:Number(saved.priority)};
   return Object.fromEntries(Object.entries(mapping).filter(([key])=>saved[key]!==basic.saved[key]).map(([key,column])=>[column,key==='priority'?Number(saved[key]):key.endsWith('_at')?(saved[key]?new Date(saved[key]).toISOString():null):saved[key]]));
  });
  if(creating&&current){basic=new DraftState(current.basic);rules=new DraftState(current.rules);field.reset(current.translations);find('#discount-show-name').checked=false;renderEditor();}
 });
 async function persist(state,scope,payload){
  busy=true;let failure;renderEditor();
  const ok=await state.save(async value=>{try{const route=scope==='create'?'':'/'+current.id+(scope==='basic'?'':'/'+scope);const data=await api(scope==='create'?'POST':scope==='translations'?'PUT':'PATCH',route,payload(value));current=prepare(data.row);}catch(error){failure=error;throw error;}});
  busy=false;find('#discount-status').textContent=ok?labels.saved:message(failure);renderEditor();if(ok)await refresh();return ok;
 }
 find('#discount-rules-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!current||!can.update||!rules.dirty())return;
  if(Object.values(rules.draft).some(rule=>rule.value!==''&&(!/^\d+(?:\.\d+)?$/.test(rule.value)||rule.value.length>128))){find('#discount-status').textContent=labels.invalidRule;return;}
  await persist(rules,'rules',saved=>Object.fromEntries(Object.entries(saved).flatMap(([side,rule])=>[[side+'_action',rule.action],[side+'_value',rule.value===''?null:rule.value]])));
 });
 all('[data-tab]').forEach(button=>{
  button.addEventListener('click',()=>selectTab(button.dataset.tab));
  button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=all('[data-tab]').filter(el=>!el.disabled),index=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});
 });
 modalElement.addEventListener('hide.bs.modal',event=>{if(busy){event.preventDefault();return;}if(!allowClose&&(basic?.dirty()||rules?.dirty()||field.state?.dirty())){event.preventDefault();find('#discount-discard').hidden=false;find('#discount-keep').focus();}});
 find('#discount-keep').addEventListener('click',()=>find('#discount-discard').hidden=true);
 find('#discount-discard-confirm').addEventListener('click',()=>{allowClose=true;modal.hide();});
 find('#discount-add')?.addEventListener('click',()=>{if(can.create)open(null);});
 find('#discount-search').addEventListener('input',()=>{generation++;clearTimeout(searchTimer);pageNumber=1;searchTimer=setTimeout(refresh,250);});find('#discount-filter').addEventListener('change',()=>{pageNumber=1;refresh();});find('#discount-prev').addEventListener('click',()=>{pageNumber--;refresh();});find('#discount-next').addEventListener('click',()=>{pageNumber++;refresh();});
 function view(value){find('#discount-items').dataset.view=value;all('[data-view]').filter(el=>el.tagName==='BUTTON').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===value)));try{localStorage.setItem('hormat.cpanel.discounts.view',value);}catch{}}
 all('button[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
 let preferred='grid';try{if(localStorage.getItem('hormat.cpanel.discounts.view')==='list')preferred='list';}catch{}view(preferred);renderList();
}
