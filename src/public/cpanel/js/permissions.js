(() => {
 'use strict';
 const form = document.getElementById('permission-form');
 if (form) {
  const switches = [...form.querySelectorAll('input[role="switch"]')];
  let initial = switches.map(input => input.checked);
  let busy = false, blocked = form.dataset.editable !== 'true';
  const save = document.getElementById('permission-save');
  const label = save.textContent;
  const feedback = document.getElementById('permission-feedback');
  const dirty = () => switches.some((input,index) => input.checked !== initial[index]);
  function update() {
   switches.forEach(input => { input.disabled = busy || blocked; });
   save.disabled = busy || blocked || !dirty();
   save.textContent = busy ? form.dataset.saving : label;
   form.setAttribute('aria-busy',String(busy));
   document.getElementById('permission-unsaved').hidden = !dirty();
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', () => { feedback.hidden = true; update(); });
  save.addEventListener('click', async () => {
   if(busy || blocked || !dirty())return;
   const permissions = Object.fromEntries(switches.map(input => [input.dataset.permissionKey,input.checked]));
   busy = true; feedback.hidden = true; update();
   let failureMessage = form.dataset.failure;
   try {
    const response = await fetch(form.dataset.endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-CSRF-Token':form.dataset.csrf},body:JSON.stringify({permissions})});
    const json = response.headers.get('content-type')?.includes('application/json');
    const result = json ? await response.json() : {message:await response.text()};
    if(!response.ok || result.success!==true) {
     if(response.status===403 || response.status===404)blocked=true;
     failureMessage = result.message || form.dataset.failure;
     throw new Error();
    }
    switches.forEach(input => { input.checked = result.permissions[input.dataset.permissionKey]===true; });
    initial = switches.map(input=>input.checked);
    feedback.textContent = result.message; feedback.classList.remove('text-danger');
   } catch(error) { feedback.textContent = failureMessage; feedback.classList.add('text-danger'); }
   finally { busy = false; feedback.hidden = false; update(); }
  });
  update();
 }
 const root = document.getElementById('permissions-page');
 if (!root) return;
 const search = document.getElementById('permissions-search');
 const status = document.getElementById('permissions-status');
 const loading = document.getElementById('permissions-loading');
 const error = document.getElementById('permissions-error');
 let timer, controller, revision = 0;
 function avatars() {
  root.querySelectorAll('.shell-avatar img').forEach(img => {
   const fallback = () => { img.hidden = true; };
   img.addEventListener('error', fallback, {once:true});
   if(img.complete && !img.naturalWidth) fallback();
  });
 }
 function invalidate() { clearTimeout(timer); controller?.abort(); return ++revision; }
 async function load(url, current = invalidate()) {
  controller = new AbortController(); loading.hidden = false; error.hidden = true;
  document.getElementById('permissions-results').setAttribute('aria-busy','true');
  try {
   const response = await fetch(url, {signal:controller.signal});
   if (!response.ok) throw new Error();
   const doc = new DOMParser().parseFromString(await response.text(),'text/html');
   const next = doc.getElementById('permissions-results');
   if (!next) throw new Error();
   if(current !== revision) return;
   document.getElementById('permissions-results').replaceWith(next);
   history.replaceState(null,'',url); avatars();
  } catch (failure) { if(current === revision && failure.name !== 'AbortError') {error.textContent=root.dataset.failure;error.hidden=false;} }
  finally { if(current === revision) {loading.hidden=true;document.getElementById('permissions-results').setAttribute('aria-busy','false');} }
 }
 const url = () => '/cpanel/permissions?' + new URLSearchParams({query:search.value,status:status.value});
 search.addEventListener('input', () => {const current=invalidate();timer=setTimeout(() => load(url(),current),300);});
 status.addEventListener('change', () => load(url()));
 document.getElementById('permissions-search-form').addEventListener('submit',event => {event.preventDefault();load(url());});
 document.getElementById('permissions-clear').addEventListener('click',event => {event.preventDefault();search.value='';status.value='active';load(url());});
 root.addEventListener('click',event => {const link=event.target.closest('.users-pagination a');if(link && !event.ctrlKey && !event.metaKey && !event.shiftKey){event.preventDefault();load(link.href);}});
 avatars();
})();
