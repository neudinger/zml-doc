(() => {
  const explorer = document.querySelector("[data-sharding-explorer]");
  if (!explorer) return;

  // Read the tensor dimensions and placement descriptions from the text version.
  const placements = new Map();
  for (const row of explorer.querySelectorAll("tr[data-placement]")) {
    const dimensions = Array.from(row.querySelectorAll("[data-dim]"), dimension => ({
      name: dimension.dataset.dim,
      size: Number(dimension.textContent),
      axis: dimension.dataset.split,
    }));
    placements.set(row.dataset.placement, {
      name: row.cells[0].textContent,
      description: row.cells[2].textContent,
      dimensions,
    });
  }

  function sliceFor(dimensions, device) {
    const coordinate = { data: Math.floor(device / 2), model: device % 2 };
    return dimensions.map(({ name, size, axis }) => {
      const length = axis ? size / 2 : size;
      const start = axis ? coordinate[axis] * length : 0;
      return { name, size, start, length };
    });
  }

  function drawPatch(patch, slice) {
    const column = slice.at(-1);
    const row = slice.length === 1 ? { start: 0, size: 1, length: 1 } : slice[0];
    patch.classList.toggle("sharding-vector", slice.length === 1);
    patch.style.setProperty("--slice-x", (100 * column.start / column.size) + "%");
    patch.style.setProperty("--slice-width", (100 * column.length / column.size) + "%");
    patch.style.setProperty("--slice-y", (100 * row.start / row.size) + "%");
    patch.style.setProperty("--slice-height", (100 * row.length / row.size) + "%");
  }

  const tensors = explorer.querySelectorAll("button[data-tensor]");
  const devices = explorer.querySelectorAll("button[data-device]");
  let tensor = "input";
  let device = 3;

  function render() {
    const selected = placements.get(tensor);
    const slice = sliceFor(selected.dimensions, device);
    const coordinate = devices[device].querySelector("code").textContent;
    explorer.querySelector("[data-slice-title]").textContent = selected.name + " on device " + coordinate;
    explorer.querySelector("[data-global-shape]").textContent = slice.map(dim => dim.size).join(" × ");
    explorer.querySelector("[data-local-shape]").textContent = slice.map(dim => dim.length).join(" × ");
    explorer.querySelector("[data-slice]").textContent = slice.map(dim =>
      `${dim.name}[${dim.start}..${dim.start + dim.length}]`).join(" · ");
    explorer.querySelector("[data-placement-note]").textContent = selected.description;
    drawPatch(explorer.querySelector(".sharding-inspector .sharding-patch"), slice);

    for (const button of devices) {
      const id = Number(button.dataset.device);
      const other = sliceFor(selected.dimensions, id);
      const same = other.every((dim, index) => dim.start === slice[index].start);
      const status = id === device ? "Selected" : same ? "Same slice" : "Different slice";
      button.setAttribute("aria-pressed", String(id === device));
      button.querySelector("small").textContent = status;
      button.setAttribute("aria-label", `Data ${Math.floor(id / 2)}, model ${id % 2}. ${status}`);
      drawPatch(button.querySelector(".sharding-patch"), other);
    }
    for (const button of tensors) {
      button.setAttribute("aria-pressed", String(button.dataset.tensor === tensor));
    }
    for (const line of explorer.querySelectorAll("[data-line]")) {
      if (line.dataset.line === tensor) line.setAttribute("aria-current", "step");
      else line.removeAttribute("aria-current");
    }
    explorer.querySelector("[data-rule-name]").textContent = " for " + tensor;
    for (const rule of explorer.querySelectorAll("[data-rule]")) {
      rule.hidden = rule.dataset.rule !== tensor;
    }
  }

  for (const button of tensors) {
    const placement = placements.get(button.dataset.tensor);
    button.querySelector("small").textContent = sliceFor(placement.dimensions, device)
      .map(dim => dim.length).join(" × ");
    button.addEventListener("click", () => {
      tensor = button.dataset.tensor;
      render();
    });
  }
  for (const button of devices) {
    button.addEventListener("click", () => {
      device = Number(button.dataset.device);
      render();
    });
  }
  render();
  explorer.querySelector(".sharding-text").open = false;
  explorer.querySelector(".sharding-controls").hidden = false;
})();
