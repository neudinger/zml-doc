const sidebar = document.querySelector(".docs-sidebar");

if (sidebar) {
  const summary = sidebar.querySelector("summary");
  const narrowViewport = window.matchMedia("(max-width: 48rem)");

  function syncSidebar() {
    if (narrowViewport.matches) {
      if (!sidebar.contains(document.activeElement)) sidebar.open = false;
      return;
    }

    sidebar.open = true;
    if (document.activeElement === summary) {
      const nextLink = sidebar.querySelector('a[aria-current="page"]') ?? sidebar.querySelector("a");
      nextLink?.focus();
    }
  }

  narrowViewport.addEventListener("change", syncSidebar);
  syncSidebar();
}
