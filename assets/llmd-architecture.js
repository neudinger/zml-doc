(() => {
  const figure = document.querySelector(".architecture-figure");
  const map = figure?.querySelector("svg");
  if (!map) return;

  const picker = figure.querySelector("[data-map-picker]");
  const title = figure.querySelector("[data-map-title]");
  const detail = figure.querySelector("[data-map-detail]");
  const mappings = figure.querySelector("[data-map-mappings]");
  const link = figure.querySelector("[data-map-section]");
  const overview = { title: title.textContent, detail: detail.textContent };
  const components = [...map.querySelectorAll("[data-component]")];
  const edges = map.querySelectorAll("[data-from][data-to]");
  const sectionGroups = new Map();
  let selected;

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
  components[0].tabIndex = 0;
  map.setAttribute("role", "group");

  function select(component) {
    selected = component;
    const key = component?.dataset.component ?? "";
    picker.value = key;
    for (const node of components) {
      node.setAttribute("aria-pressed", String(node === component));
      node.tabIndex = node === (component ?? components[0]) ? 0 : -1;
    }
    for (const edge of edges) {
      edge.toggleAttribute("data-active", edge.dataset.from === key || edge.dataset.to === key);
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
      link.href = "#" + component.dataset.section;
      link.textContent = "Read " + sectionGroups.get(component.dataset.section).label;
    } else {
      link.removeAttribute("href");
      link.textContent = "";
    }
  }

  picker.addEventListener("change", () => select(components.find(node => node.dataset.component === picker.value)));
  map.addEventListener("click", (event) => {
    const component = event.target.closest("[data-component]");
    if (component) select(component === selected ? undefined : component);
  });
  map.addEventListener("keydown", (event) => {
    const component = event.target.closest("[data-component]");
    if (!component) return;
    const index = components.indexOf(component);
    let next;
    switch (event.key) {
      case "Enter": case " ":
        event.preventDefault();
        select(component === selected ? undefined : component);
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
  for (const control of figure.querySelectorAll("[data-map-control]")) control.hidden = false;
})();
