/* global jQuery */
jQuery(() => {
  const form = document.getElementById('login-form');
  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const toggle = document.getElementById('password-toggle');
  const status = document.getElementById('login-status');
  toggle.disabled = false;
  document.getElementById('login-submit').disabled = false;



  for (const input of [email, password]) {
    jQuery(input).on('input', () => {
      input.removeAttribute('aria-invalid');
      document.getElementById(input.getAttribute('aria-describedby')).hidden = true;
      status.hidden = true;
    });
  }
  jQuery(form).on('submit', (event) => {
    status.hidden = true;
    let firstInvalid;
    for (const input of [email, password]) {
      const message = input.validity.valueMissing ? input.dataset.required : input.validity.typeMismatch ? input.dataset.invalid : '';
      const error = document.getElementById(input.getAttribute('aria-describedby'));
      error.textContent = message;
      error.hidden = !message;
      input.setAttribute('aria-invalid', String(Boolean(message)));
      if (message && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) { event.preventDefault(); firstInvalid.focus(); }
  });
  jQuery('#login-language').on('change', function () { this.form.requestSubmit(); });
  jQuery('.language-apply').prop('hidden', true);
});
