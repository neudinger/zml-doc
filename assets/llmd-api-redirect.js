(() => {
  const links = document.querySelectorAll("[data-api-destinations] a");
  const match = Array.from(links).find(link => link.hash === location.hash);
  const destination = new URL(match?.href ?? document.querySelector('link[rel="canonical"]').href);
  destination.search = location.search;
  location.replace(destination.href);
})();
