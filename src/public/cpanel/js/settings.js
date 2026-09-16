const form=document.getElementById('settings-form'),save=document.getElementById('settings-save'),status=document.getElementById('settings-status');
if(form&&save){
 const value=()=>Object.fromEntries(['language','currency','payment','delivery','orderStatus'].map(key=>[key,form.elements.namedItem(key).value||null]));
 let original=JSON.stringify(value()),busy=false;
 const dirty=()=>JSON.stringify(value())!==original;
 const update=()=>{save.disabled=busy||!dirty();};
 form.addEventListener('change',()=>{status.textContent='';update();});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!dirty())return;const body=value();busy=true;form.querySelector('fieldset').disabled=true;save.querySelector('[data-idle]').hidden=true;save.querySelector('[data-busy]').hidden=false;update();status.textContent='';
  try{const response=await fetch('/cpanel/api/settings/defaults',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':form.dataset.csrf},body:JSON.stringify(body)}),result=await response.json();if(!response.ok||!result.success)throw new Error(result.code||'SETTINGS_FAILED');
   for(const [key,v] of Object.entries(result.defaults))form.elements.namedItem(key).value=v??'';
   original=JSON.stringify(value());if(result.defaults.currency)form.elements.namedItem('currency').querySelector('option[value=""]').disabled=true;
   status.textContent=result.cacheRefreshed?form.dataset.saved:form.dataset.cache;status.className='small mb-0 text-success';
  }catch(error){status.textContent=error.message==='SETTINGS_INVALID_CURRENCY'?form.dataset.currency:error.message==='SETTINGS_LANGUAGE_INCOMPLETE'?form.dataset.incomplete:error.message==='SETTINGS_INVALID'?form.dataset.invalid:form.dataset.failed;status.className='small mb-0 text-danger';}
  finally{busy=false;form.querySelector('fieldset').disabled=false;save.querySelector('[data-idle]').hidden=false;save.querySelector('[data-busy]').hidden=true;update();}
 });
}
