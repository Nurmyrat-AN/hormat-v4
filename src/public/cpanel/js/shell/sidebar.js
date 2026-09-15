/* global bootstrap, jQuery */
(() => {
  const root = document.documentElement;
  const sidebar = document.getElementById('cpanel-sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const pin = document.getElementById('sidebar-pin');
  const desktop = matchMedia('(min-width: 992px)');
  const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(sidebar);
  const expanded = () => root.dataset.sidebar === 'expanded' || root.dataset.sidebarPreview === 'true';
  const update = () => {
    const label = root.dataset.pinned === 'true' ? pin.dataset.unpin : pin.dataset.pin;
    pin.setAttribute('aria-label', label); pin.title = label;
    pin.setAttribute('aria-pressed', root.dataset.pinned);
    pin.querySelector('.sidebar-label').textContent = label;
    toggle.setAttribute('aria-expanded', String(desktop.matches ? expanded() : sidebar.classList.contains('show')));
  };
  const preview = (open) => {
    root.dataset.sidebarPreview = String(open && desktop.matches && root.dataset.pinned === 'false' && root.dataset.sidebar === 'collapsed');
    update();
  };
  toggle.addEventListener('click', () => {
    if (!desktop.matches) { offcanvas.toggle(); return; }
    root.dataset.sidebar = root.dataset.sidebar === 'collapsed' ? 'expanded' : 'collapsed';
    root.dataset.sidebarPreview = 'false';
    window.cpanelPreferences.write('sidebar', root.dataset.sidebar);
    update();
  });
  pin.addEventListener('click', () => {
    root.dataset.pinned = root.dataset.pinned === 'true' ? 'false' : 'true';
    // Pin the currently visible state; unpin does not unexpectedly change width.
    if (root.dataset.pinned === 'true' && root.dataset.sidebarPreview === 'true') {
      root.dataset.sidebar = 'expanded'; window.cpanelPreferences.write('sidebar', 'expanded');
    }
    root.dataset.sidebarPreview = 'false';
    window.cpanelPreferences.write('pinned', root.dataset.pinned); update();
  });
  sidebar.addEventListener('pointerenter', () => preview(true));
  sidebar.addEventListener('pointerleave', () => { if (!sidebar.contains(document.activeElement)) preview(false); });
  sidebar.addEventListener('focusin', () => preview(true));
  sidebar.addEventListener('focusout', () => setTimeout(() => { if (!sidebar.contains(document.activeElement) && !sidebar.matches(':hover')) preview(false); }, 0));
  sidebar.addEventListener('keydown', event => {
    if (event.key === 'Escape' && desktop.matches && root.dataset.sidebarPreview === 'true') { toggle.focus(); preview(false); }
  });
  // Bootstrap owns the reusable collapse behavior; expand the icon rail before opening a submenu.
  sidebar.querySelectorAll('.submenu-toggle').forEach(button => button.addEventListener('click', () => {
    const submenu = bootstrap.Collapse.getOrCreateInstance(document.querySelector(button.dataset.bsTarget), { toggle: false });
    if (desktop.matches && !expanded()) {
      root.dataset.sidebar = 'expanded'; window.cpanelPreferences.write('sidebar', 'expanded'); update();
      submenu.show();
    } else { submenu.toggle(); }
  }));
  for (const event of ['show.bs.collapse', 'hide.bs.collapse']) sidebar.addEventListener(event, e => {
    const button = Array.from(sidebar.querySelectorAll('.submenu-toggle')).find(item => item.getAttribute('aria-controls') === e.target.id);
    if (button) button.setAttribute('aria-expanded', String(event === 'show.bs.collapse'));
  });
  sidebar.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', () => { if (!desktop.matches) offcanvas.hide(); }));
  sidebar.addEventListener('shown.bs.offcanvas', update);
  sidebar.addEventListener('hidden.bs.offcanvas', () => { update(); if (!desktop.matches) toggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !desktop.matches && (sidebar.classList.contains('show') || sidebar.classList.contains('showing'))) offcanvas.hide();
  });
  desktop.addEventListener('change', () => { offcanvas.hide(); preview(false); update(); });
  jQuery('#shell-language').on('change', function () { this.form.requestSubmit(); });
  jQuery('.shell-language-apply').prop('hidden', true);
  document.querySelectorAll('.shell-avatar img').forEach(img => {
    const fallback = () => { img.hidden = true; };
    img.addEventListener('error', fallback);
    if (img.complete && !img.naturalWidth) fallback();
  });
  update();
})();
