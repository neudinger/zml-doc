(() => {
  const figure = document.querySelector(".architecture-figure");
  const map = figure?.querySelector("svg");
  if (!map) return;

  const picker = figure.querySelector("[data-map-picker]");
  const title = figure.querySelector("[data-map-title]");
  const detail = figure.querySelector("[data-map-detail]");
  const mappings = figure.querySelector("[data-map-mappings]");
  const link = figure.querySelector("[data-map-section]");
  const neighbors = figure.querySelector("[data-map-neighbors]");
  const layerButtons = figure.querySelectorAll("[data-map-entry]");
  const overview = { title: title.textContent, detail: detail.textContent };
  const components = [...map.querySelectorAll("[data-component]")];
  const byKey = new Map(components.map(node => [node.dataset.component, node]));
  const edges = map.querySelectorAll("[data-from][data-to]");
  const sectionGroups = new Map();
  let selected;

  // Measure the space above the diagram at the top of the page, before its pane sticks.
  const toolbar = figure.querySelector(".architecture-toolbar");
  const fit = new ResizeObserver(() => {
    const offset = figure.getBoundingClientRect().top + window.scrollY + toolbar.offsetHeight;
    figure.style.setProperty("--map-top", Math.ceil(offset) + "px");
  });
  fit.observe(document.querySelector(".site-header"));
  fit.observe(figure.closest(".architecture-overview").querySelector(".document-header"));
  fit.observe(toolbar);

  for (const component of components) {
    const section = component.dataset.section;
    if (!sectionGroups.has(section)) {
      const group = document.createElement("optgroup");
      group.label = document.getElementById(section).textContent.trim();
      sectionGroups.set(section, group);
      picker.append(group);
    }
    sectionGroups.get(section).append(new Option(component.getAttribute("aria-label"), component.dataset.component));
    component.setAttribute("role", "button");
    component.setAttribute("aria-pressed", "false");
    component.tabIndex = -1;
  }
  map.setAttribute("role", "group");

  function select(component) {
    selected = component;
    const key = component?.dataset.component ?? "";
    picker.value = key;
    for (const node of components) {
      node.setAttribute("aria-pressed", String(node === component));
      node.tabIndex = node === (component ?? components[0]) ? 0 : -1;
    }
    for (const button of layerButtons) {
      const layer = byKey.get(button.dataset.mapEntry).dataset.section;
      button.setAttribute("aria-pressed", String(layer === component?.dataset.section));
    }
    const connected = new Set();
    for (const edge of edges) {
      const { from, to } = edge.dataset;
      edge.toggleAttribute("data-active", from === key || to === key);
      if (from === key) connected.add(to);
      if (to === key) connected.add(from);
    }
    title.textContent = component?.getAttribute("aria-label") ?? overview.title;
    detail.textContent = component?.querySelector(":scope > desc")?.textContent ?? overview.detail;
    mappings.replaceChildren();
    for (const cell of component?.querySelectorAll("[data-platform]") ?? []) {
      const pair = document.createElement("div");
      const platform = document.createElement("dt");
      const implementation = document.createElement("dd");
      platform.textContent = cell.dataset.platform;
      implementation.textContent = cell.textContent === "—" ? "Unspecified" : cell.textContent;
      pair.append(platform, implementation);
      mappings.append(pair);
    }
    mappings.hidden = !mappings.childElementCount;
    link.hidden = !component;
    if (component) {
      link.href = "#component-" + key;
      link.textContent = "Read " + title.textContent + " reference";
    } else {
      link.removeAttribute("href");
      link.textContent = "";
    }
    neighbors.replaceChildren();
    for (const other of connected) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = byKey.get(other).getAttribute("aria-label");
      button.addEventListener("click", () => {
        select(byKey.get(other));
        picker.focus({ preventScroll: true });
      });
      neighbors.append(button);
    }
    neighbors.parentElement.hidden = !connected.size;
  }

  for (const button of layerButtons) {
    button.addEventListener("click", () => select(byKey.get(button.dataset.mapEntry)));
  }
  picker.addEventListener("change", () => select(byKey.get(picker.value)));
  map.addEventListener("click", (event) => {
    const component = event.target.closest("[data-component]");
    if (component) select(component);
  });
  map.addEventListener("keydown", (event) => {
    const component = event.target.closest("[data-component]");
    if (!component) return;
    const index = components.indexOf(component);
    let next;
    switch (event.key) {
      case "Enter": case " ":
        event.preventDefault();
        select(component);
        return;
      case "ArrowRight": case "ArrowDown": next = (index + 1) % components.length; break;
      case "ArrowLeft": case "ArrowUp": next = (index + components.length - 1) % components.length; break;
      case "Home": next = 0; break;
      case "End": next = components.length - 1; break;
      default: return;
    }
    event.preventDefault();
    select(components[next]);
    components[next].focus({ preventScroll: true });
  });
  function bookmarkedComponent() {
    return location.hash.startsWith("#component-") ? byKey.get(location.hash.slice("#component-".length)) : undefined;
  }
  window.addEventListener("hashchange", () => {
    const component = bookmarkedComponent();
    if (component && component !== selected) select(component);
  });
  select(bookmarkedComponent() ?? byKey.get("compiler"));
  for (const control of figure.querySelectorAll("[data-map-control]")) control.hidden = false;
})();
