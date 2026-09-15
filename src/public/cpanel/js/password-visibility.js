document.querySelectorAll('[data-password-toggle]').forEach(toggle => {
  const password = document.getElementById(toggle.getAttribute('aria-controls'));
  toggle.disabled = false;
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? toggle.dataset.hide : toggle.dataset.show);
    toggle.querySelector('.icon-show').hidden = visible;
    toggle.querySelector('.icon-hide').hidden = !visible;
  });
});
