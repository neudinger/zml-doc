(() => {
  const map = document.querySelector(".architecture-compact");
  if (!map) return;

  const geometry = map.querySelector(".source-geometry");
  const svg = geometry.querySelector("svg");
  const mobile = map.querySelector(".source-mobile");
  const picker = map.querySelector("[data-picker]");
  const notes = map.querySelector("[data-notes-toggle]");
  const readout = map.querySelector(".source-selection");
  const title = readout.querySelector("[data-selected-title]");
  const section = readout.querySelector("[data-selected-path]");
  const detail = readout.querySelector("[data-selected-detail]");
  const reference = readout.querySelector("[data-selected-reference]");

  const layerNames = [
    "Applications", "LLMD APIs", "Engine", "Qwen 3.5", "Reusable components",
    "Other models built from them", "Kernels", "ZML", "Platforms",
  ];
  const descriptions = {
    "Kernels": "Named kernel implementation in the System map.",
    "Other models built from them": "Example listed in the model and drafter row of the System map.",
  };
  const originalCopy = new Map([...svg.querySelectorAll("[data-source-copy]")]
    .map(node => [node.dataset.sourceCopy, node.textContent]));
  const components = [...svg.querySelectorAll("rect[data-source-group]")].map((rect, index) => {
    const {sourceGroup, sourceTitle, sourceOption, sourceDetail, sourceReference} = rect.dataset;
    const label = sourceTitle ?? [...rect.nextElementSibling.childNodes]
      .map(node => node.textContent.trim()).filter(Boolean).join(" ");
    return {
      id: String(index + 1),
      rect,
      label,
      option: sourceOption ?? label,
      group: sourceGroup,
      description: sourceDetail ?? descriptions[sourceGroup],
      reference: sourceReference,
    };
  });
  const groups = new Map(layerNames.map(layer => [layer, components.filter(component => component.group === layer)]));
  let selected;

  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(component, className, label) {
    const node = create("button", className, label);
    node.type = "button";
    node.dataset.mapComponent = component.id;
    node.setAttribute("aria-label", `${component.option} · ${component.group}`);
    node.setAttribute("aria-pressed", "false");
    node.addEventListener("click", () => select(component));
    return node;
  }

  function arrow(label = "↓") {
    const node = create("span", "source-arrow", label);
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function items(group, {flow = false, ellipsisAt} = {}) {
    const row = create("div", "source-items");
    group.forEach((component, index) => {
      if (flow && index > 0) row.append(arrow("→"));
      if (ellipsisAt === index) row.append(create("span", "source-ellipsis", "…"));
      component.mobileButton = button(component, "source-item", component.label);
      row.append(component.mobileButton);
    });
    if (ellipsisAt === group.length) row.append(create("span", "source-ellipsis", "…"));
    return row;
  }

  function note(...keys) {
    const node = create("p", "source-annotation", keys.map(key => originalCopy.get(key)).join(" · "));
    node.dataset.annotation = "";
    return node;
  }

  function band(label, className, ...children) {
    const node = create("section", className);
    if (label) node.append(create("h3", "", label));
    else node.setAttribute("aria-label", "Applications");
    node.append(...children);
    return node;
  }

  const flow = groups.get("Qwen 3.5");
  const decoder = create("div", "source-decoder");
  decoder.append(create("h4", "", "decoder layer × N"), items(flow.slice(1, 5), {flow: true}));
  const model = create("div", "source-model");
  model.append(items(flow.slice(0, 1)), arrow(), decoder, arrow(), items(flow.slice(5), {flow: true}));
  const reusable = groups.get("Reusable components");
  const otherModels = groups.get("Other models built from them");
  const kernels = groups.get("Kernels");
  const zml = groups.get("ZML");

  mobile.append(
    band(null, "source-band-client",
      items(groups.get("Applications")), note("client-type", "client-protocol")),
    arrow("↕"),
    band("LLMD", "source-band-llmd",
      items(groups.get("LLMD APIs"), {ellipsisAt: 3}),
      create("h4", "", "Engine"), items(groups.get("Engine")),
      create("h4", "", "Models"), note("model-tagline"), create("h4", "", "Qwen 3.5"), model,
      create("h4", "", "Reusable components"), items(reusable, {ellipsisAt: reusable.length}),
      create("h4", "", "Other models built from them"), items(otherModels, {ellipsisAt: otherModels.length})),
    arrow(), note("kernel-selection"),
    band("Kernels", "source-band-kernels",
      note("kernel-tagline"), note("kernel-dsls"), items(kernels, {ellipsisAt: kernels.length})),
    arrow(), note("runtime-runs", "runtime-loads", "tensor-model", "tensor-ops", "custom-kernels", "portable-ops"),
    band("ZML", "source-band-zml", items(zml.slice(0, -1)), items(zml.slice(-1)), note("pjrt-source")),
    arrow(), note("pjrt-plugins", "platform-dsls"),
    band("Platforms", "source-band-platforms", items(groups.get("Platforms"))),
  );

  const {width, height} = svg.viewBox.baseVal;
  for (const [group, members] of groups) {
    const choices = create("optgroup");
    choices.label = group;
    for (const component of members) {
      choices.append(new Option(component.option, component.id));
      const target = button(component, "source-target");
      const {x, y, width: w, height: h} = component.rect;
      target.style.left = `${100 * x.baseVal.value / width}%`;
      target.style.top = `${100 * y.baseVal.value / height}%`;
      target.style.width = `${100 * w.baseVal.value / width}%`;
      target.style.height = `${100 * h.baseVal.value / height}%`;
      component.desktopButton = target;
      geometry.append(target);
    }
    picker.append(choices);
  }

  function positionReadout() {
    const compact = getComputedStyle(mobile).display !== "none";
    const row = compact ? selected?.mobileButton.parentElement : null;
    if (row) {
      if (row.nextElementSibling !== readout) row.after(readout);
    } else if (readout.parentElement !== map) {
      map.append(readout);
    }
  }

  function select(component) {
    selected = component;
    picker.value = component?.id ?? "";
    for (const item of components) {
      const pressed = String(item === component);
      item.desktopButton.setAttribute("aria-pressed", pressed);
      item.mobileButton.setAttribute("aria-pressed", pressed);
    }
    readout.hidden = !component;
    if (component) {
      title.textContent = component.label;
      section.textContent = component.group;
      detail.textContent = component.description ?? "";

      const target = component.reference && document.getElementById(component.reference);
      reference.hidden = !target;
      if (target) reference.setAttribute("href", "#" + target.id);
      else reference.removeAttribute("href");
    }
    positionReadout();
  }

  picker.addEventListener("change", () => select(components.find(component => component.id === picker.value)));
  notes.addEventListener("change", () => { map.dataset.notes = notes.checked ? "on" : "off"; });
  map.dataset.ready = "";
  for (const control of map.querySelectorAll("[data-compact-control]")) control.hidden = false;
  new ResizeObserver(positionReadout).observe(map);
})();
