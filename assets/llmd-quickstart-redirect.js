(() => {
  const link = document.querySelector("[data-quickstart-redirect], .llmd-launch-link");
  if (!link) return;
  const alias = link.hasAttribute("data-quickstart-redirect");

  function forward() {
    const target = new URL(link.href);
    const fragment = location.hash;
    target.search = location.search;
    const params = target.searchParams;
    const hasSelection = params.has("recipe")
      || (params.has("backend") && (params.has("model") || params.has("checkpoint")));

    if (alias) {
      if (fragment) {
        if (!hasSelection) params.set("recipe", target.hash.slice(1));
        target.hash = fragment;
      } else if (hasSelection) {
        target.hash = "";
      }
    } else {
      const section = document.getElementById(fragment.slice(1));
      if (section?.matches("a[data-moved-topic]")) {
        location.replace(section.href);
        return;
      }
      // Keep first-run bookmarks on Quickstart and forward launch selections to the workspace.
      if (!hasSelection && (section || !fragment)) return;
      target.hash = section ? "" : fragment;
    }

    location.replace(target);
  }

  if (!alias) addEventListener("hashchange", forward);
  forward();
})();
