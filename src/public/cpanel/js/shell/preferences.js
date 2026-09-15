// Blocking head script: apply preferences before styles/content can paint.
(() => {
  const root = document.documentElement;
  const read = (key, fallback) => { try { return localStorage.getItem(`hormat.cpanel.${key}`) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(`hormat.cpanel.${key}`, value); } catch { /* Storage may be disabled. UI still works. */ } };
  root.dataset.bsTheme = read('theme', 'light') === 'dark' ? 'dark' : 'light';
  root.dataset.sidebar = read('sidebar', 'expanded') === 'collapsed' ? 'collapsed' : 'expanded';
  root.dataset.pinned = read('pinned', 'true') === 'false' ? 'false' : 'true';
  window.cpanelPreferences = { write };
})();
