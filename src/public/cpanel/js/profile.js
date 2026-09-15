/* global bootstrap */
(() => {
  const saveButton = document.querySelector('#basic [data-preview-action]');
  const uploaders = Array.from(document.querySelectorAll('[data-media-uploader]'), element => element.mediaUploader);
  const basicForm = document.getElementById('profile-form');
  const basicStatus = document.getElementById('profile-status');
  saveButton.disabled = false;
  basicForm.addEventListener('submit', window.HormatMediaUploader.createSaveHandler(uploaders, async tokens => {
    basicStatus.hidden = true;
    const body = new URLSearchParams(new FormData(basicForm));
    if (tokens[0]) body.set('avatarCacheToken', tokens[0]);
    // Freeze selection only during the profile request; selection remains cancellable while uploading.
    const controls = Array.from(document.querySelectorAll('#basic input, #basic button'));
    const disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    try {
      const response = await fetch('/cpanel/profile', { method: 'POST', body, headers: { Accept: 'application/json' } });
      if (response.redirected) { location.assign('/cpanel/login'); return; }
      const result = await response.json();
      if (response.ok && result.success) {
        location.assign('/cpanel/profile?updated=1#basic');
        // Keep the shared duplicate-Save guard held until the new document loads.
        await new Promise(() => {});
      }
      basicStatus.textContent = result.message || basicStatus.dataset.failure;
      if (tokens[0] && ['avatarFailed', 'failure'].includes(result.code)) {
        uploaders[0].state = 'error'; uploaders[0].cacheToken = null;
        uploaders[0].error = 'MEDIA_UPLOAD_FAILED'; uploaders[0].render();
      }
    } catch { basicStatus.textContent = basicStatus.dataset.failure; }
    finally { controls.forEach((control, index) => { control.disabled = disabled[index]; }); }
    basicStatus.hidden = false;
  }, saveButton));
  // The query marker only controls a translated notice; current data always comes from PostgreSQL.
  if (new URLSearchParams(location.search).get('updated') === '1') history.replaceState(null, '', '/cpanel/profile#basic');
  const syncTab = () => bootstrap.Tab.getOrCreateInstance(document.getElementById(location.hash === '#password' ? 'password-tab' : 'basic-tab')).show();
  document.querySelectorAll('.profile-tabs [data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', () => {
      const hash = tab.dataset.bsTarget;
      if (location.hash !== hash) history.pushState(null, '', hash);
    });
  });
  window.addEventListener('hashchange', syncTab);
  const form = document.getElementById('password-form');
  if (form.dataset.result) history.replaceState(null, '', '/cpanel/profile#password');
  const status = document.getElementById('password-status');
  form.addEventListener('submit', event => {
    const values = ['currentPassword', 'newPassword', 'confirmPassword'].map(name => form.elements.namedItem(name).value);
    const message = values.some(value => !value) ? status.dataset.required : values[1] !== values[2] ? status.dataset.mismatch : '';
    if (message) { event.preventDefault(); status.textContent = message; status.hidden = false; return; }
    document.getElementById('password-submit').disabled = true;
  });
  window.addEventListener('pageshow', () => { document.getElementById('password-submit').disabled = false; });
  syncTab();
})();
