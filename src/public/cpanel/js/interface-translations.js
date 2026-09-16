const root=document.getElementById('interface-translations');
const $=id=>document.getElementById(id),labels=Object.fromEntries([...root.querySelectorAll('[data-label]')].map(el=>[el.dataset.label,el.textContent]));
const modalEl=$('translation-dialog'),modal=bootstrap.Modal.getOrCreateInstance(modalEl),save=$('translation-save');
let page=1,generation=0,timer,busy=false,selected='',baseline={},canUpdate=root.dataset.update==='true';
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
async function api(path='',method='GET',body){const response=await fetch('/cpanel/api/interface-translations'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':root.dataset.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(response.status===403?labels.denied:labels.failed);return data;}
function values(){return Object.fromEntries([...$('translation-fields').querySelectorAll('textarea')].map(el=>[el.dataset.language,el.value]));}
function dirty(){return JSON.stringify(values())!==JSON.stringify(baseline);}
function state(){if(save){save.disabled=busy||!canUpdate||!dirty();save.textContent=busy?labels.saving:labels.save;}for(const el of $('translation-fields').querySelectorAll('textarea'))el.disabled=busy||!canUpdate;}
function options(select,entries){const selected=select.value;while(select.options.length>1)select.remove(1);for(const [value,label]of entries)select.add(new Option(label,value));select.value=entries.some(([value])=>value===selected)?selected:'';}
async function load(){const current=++generation;const params=new URLSearchParams({query:$('translations-search').value,prefix:$('translations-prefix').value,completion:$('translations-completion').value,language:$('translations-completion').value==='missing'?$('translations-language').value:'',page:String(page)});try{
 const data=await api('?'+params);if(current!==generation)return;
 options($('translations-prefix'),data.groups.map(group=>[group,group]));options($('translations-language'),data.languages.map(l=>[l.code,l.display_name]));
 $('translations-summary').textContent=`${labels.total}: ${data.summary.total} · ${labels.complete}: ${data.summary.complete} · ${labels.missing}: ${data.summary.missing}`;
 const headings=$('translations-columns');headings.replaceChildren(...[labels.key,...data.languages.map(l=>l.code.toUpperCase()),labels.status].map(text=>{const el=node('th',text);el.scope='col';return el;}));
 const tbody=$('translations-table').querySelector('tbody');tbody.replaceChildren();
 for(const row of data.rows){const tr=node('tr');tr.dataset.key=row.key;tr.addEventListener('click',event=>{if(!event.target.closest('button'))open(row.key);});const key=node('td'),button=node('button',row.key,'btn btn-link p-0 translation-key');button.type='button';button.addEventListener('click',()=>open(row.key));key.append(button);tr.append(key);
  for(const language of data.languages){const value=row.values[language.code],td=node('td');td.append(node('span',value?.trim()?value:'—','translation-value'+(value?.trim()?'':' text-body-secondary')));tr.append(td);}
  const status=node('td');status.append(node('span',row.missing.length?labels.missing+': '+row.missing.map(code=>code.toUpperCase()).join(', '):labels.complete,row.missing.length?'small text-body-secondary':'small text-success'));tr.append(status);tbody.append(tr);
 }
 if(!data.rows.length){const tr=node('tr'),td=node('td',labels.empty,'text-body-secondary');td.colSpan=data.languages.length+2;tr.append(td);tbody.append(tr);}
 $('translations-page').textContent=`${page} / ${Math.max(1,Math.ceil(data.total/50))}`;$('translations-prev').disabled=page===1;$('translations-next').disabled=page*50>=data.total;
 $('translations-feedback').textContent='';
 }catch(error){if(current===generation)$('translations-feedback').textContent=error.message;}}
async function open(key){try{const data=await api('/'+encodeURIComponent(key));selected=data.key;$('translation-key').value=selected;const fields=$('translation-fields');fields.replaceChildren();
 for(const language of data.languages){const wrap=node('div',undefined,'mb-3'),label=node('label',language.code.toUpperCase()+' — '+language.display_name,'form-label'),input=node('textarea',undefined,'form-control');input.id='translation-value-'+language.code;input.dataset.language=language.code;input.maxLength=20000;input.value=data.values[language.code]??'';label.htmlFor=input.id;if(language.is_default)label.append(node('span',labels.default,'badge text-bg-secondary ms-2'));wrap.append(label,input);fields.append(wrap);}
 baseline=values();$('translation-feedback').textContent=canUpdate?'':labels.readOnly;state();modal.show();
 }catch(error){$('translations-feedback').textContent=error.message;}}
$('translation-fields').addEventListener('input',state);
modalEl.addEventListener('hide.bs.modal',event=>{if(busy||dirty()&&!window.confirm(labels.discard))event.preventDefault();});
$('translation-form').addEventListener('submit',async event=>{event.preventDefault();if(busy||!canUpdate||!dirty())return;const submitted=values(),changed=Object.fromEntries(Object.entries(submitted).filter(([code,value])=>baseline[code]!==value));busy=true;state();$('translation-feedback').textContent=labels.saving;
 try{const data=await api('/'+encodeURIComponent(selected),'PUT',{values:changed});for(const [code,value]of Object.entries(submitted)){const input=$('translation-value-'+code);if(!value.trim())input.value='';}baseline=values();$('translation-feedback').textContent=data.cacheRefreshed?labels.saved:labels.pending;await load();}catch(error){$('translation-feedback').textContent=error.message;}finally{busy=false;state();}});
$('translations-search').addEventListener('input',()=>{clearTimeout(timer);++generation;timer=setTimeout(()=>{page=1;load();},250);});
for(const id of ['translations-prefix','translations-completion','translations-language'])$(id).addEventListener('change',()=>{page=1;$('translations-language-wrap').hidden=$('translations-completion').value!=='missing';load();});
$('translations-prev').addEventListener('click',()=>{page--;load();});$('translations-next').addEventListener('click',()=>{page++;load();});
load();
