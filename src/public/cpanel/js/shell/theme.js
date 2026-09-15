(() => {
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  const update = () => {
    const label = root.dataset.bsTheme === 'dark' ? button.dataset.light : button.dataset.dark;
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  update();
  button.addEventListener('click', () => {
    root.dataset.bsTheme = root.dataset.bsTheme === 'dark' ? 'light' : 'dark';
    window.cpanelPreferences.write('theme', root.dataset.bsTheme);
    update();
  });
})();
