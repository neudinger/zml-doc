(() => {
  const oldHash = location.hash;
  const renamed = Array.from(document.querySelectorAll("[data-legacy-fragment]"))
    .find(link => "#" + link.id === oldHash);
  const target = new URL((renamed ?? document.querySelector("[data-doc-redirect]")).href);
  target.search = location.search;
  if (!renamed) target.hash = oldHash;
  location.replace(target.href);
})();
