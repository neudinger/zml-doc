(() => {
  const home = new URL(document.querySelector('link[rel="canonical"]').href);
  home.search = location.search;
  home.hash = location.hash;
  location.replace(home.href);
})();
