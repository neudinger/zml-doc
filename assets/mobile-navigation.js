(() => {
  const drawer = document.querySelector("#mobile-navigation");
  if (typeof drawer?.showModal !== "function") return;

  const root = document.documentElement;
  const trigger = document.querySelector(".mobile-navigation-trigger");
  const mobile = window.matchMedia("(max-width: 48rem)");
  const overview = drawer.querySelector("[data-mobile-overview]");
  const products = drawer.querySelector("[data-mobile-products]");
  const sections = new Map(Array.from(drawer.querySelectorAll("[data-mobile-pages]"),
    panel => [panel.dataset.mobilePages, panel]));
  let activeSection;

  // Share the desktop product targets and homepage links, including their base paths.
  for (const link of document.querySelectorAll(".product-tabs > a, .home-paths a")) {
    const mobileLink = link.cloneNode(true);
    mobileLink.removeAttribute("id");
    products.append(mobileLink);
  }

  function showOverview() {
    for (const panel of sections.values()) panel.hidden = true;
    overview.hidden = false;
    activeSection = null;
  }

  trigger.addEventListener("click", () => {
    showOverview();
    drawer.showModal();
    drawer.scrollTop = 0;
    trigger.setAttribute("aria-expanded", "true");
  });

  drawer.addEventListener("click", event => {
    if (event.target === drawer) {
      const bounds = drawer.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right) drawer.close();
      return;
    }
    const section = event.target.closest("[data-mobile-section]");
    if (section) {
      const panel = sections.get(section.dataset.mobileSection);
      overview.hidden = true;
      panel.hidden = false;
      activeSection = section;
      drawer.scrollTop = 0;
      panel.querySelector(".mobile-navigation-back").focus({ preventScroll: true });
    } else if (event.target.closest(".mobile-navigation-back")) {
      const previous = activeSection;
      showOverview();
      previous.focus({ preventScroll: true });
    } else if (event.target.closest("a[href]") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      drawer.close();
    }
  });

  drawer.addEventListener("close", () => {
    if (drawer.open) return;
    trigger.setAttribute("aria-expanded", "false");
    const destination = mobile.matches ? trigger : document.querySelector(".site-header .brand");
    destination.focus({ preventScroll: true });
  });

  mobile.addEventListener("change", () => {
    if (!mobile.matches && drawer.open) drawer.close();
  });
  trigger.hidden = false;
  root.dataset.mobileNavigation = "";
})();
