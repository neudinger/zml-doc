(() => {
  const catalog = document.querySelector("[data-model-catalog]");
  const matrix = document.querySelector(".model-catalog-table");
  const table = matrix?.querySelector("table");
  if (!catalog || !table) return;

  const search = catalog.querySelector('input[name="checkpoint"]');
  const backendFilter = catalog.querySelector('select[name="backend"]');
  const precisionFilter = catalog.querySelector('select[name="precision"]');
  const status = catalog.querySelector('[role="status"]');
  const empty = catalog.querySelector("[data-model-empty]");
  const navigator = catalog.querySelector(".model-catalog-navigator");
  const familyButtons = navigator.querySelector(".model-catalog-family-buttons");
  const familySelect = navigator.querySelector('select[name="family"]');
  const familyResults = navigator.querySelector("#model-catalog-family");
  const familyHeading = familyResults.querySelector("#model-catalog-family-heading");
  const familyCount = familyResults.querySelector("[data-model-family-count]");
  const panel = catalog.querySelector(".model-catalog-recipe");
  const selectedCheckpoint = panel.querySelector("[data-model-checkpoint]");
  const selectedDetails = panel.querySelector("[data-model-details]");
  const selectedLinks = panel.querySelector("[data-model-links]");
  let selected = null;

  const [header, ...rows] = Array.from(table.rows);
  const sourceBody = rows[0]?.parentElement;
  const shortNames = {
    "NVIDIA CUDA": "CUDA",
    "AMD ROCm": "ROCm",
    "Apple Metal": "Metal",
    "Intel oneAPI": "oneAPI",
    "Google TPU": "TPU",
    "Furiosa RNGD": "RNGD",
  };
  table.setAttribute("aria-label", "Checkpoint compatibility by backend");
  table.setAttribute("role", "table");
  table.createTHead().append(header);
  header.cells[0].scope = "col";
  header.cells[1].remove();
  const columns = Array.from(header.cells).slice(1).map(cell => {
    const backend = cell.textContent.trim();
    cell.scope = "col";
    cell.textContent = shortNames[backend] ?? backend;
    cell.setAttribute("aria-label", backend);
    backendFilter.add(new Option(backend, backend));
    return { cell, backend };
  });

  // The static matrix supplies family membership, filters, and launch links.
  const families = new Map();
  const precisions = new Set();
  for (const row of rows) {
    const [label, familyCell, ...backendCells] = Array.from(row.cells);
    const name = label.textContent.trim();
    const familyName = familyCell.textContent.trim() || "Other checkpoints";
    familyCell.remove();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.append(...label.childNodes);
    label.replaceWith(heading);
    const cells = backendCells.map((cell, index) => {
      const { backend } = columns[index];
      const caption = document.createElement("span");
      caption.className = "model-catalog-backend";
      caption.textContent = shortNames[backend] ?? backend;
      caption.setAttribute("aria-hidden", "true");
      const precision = cell.querySelector("code")?.textContent.trim();
      if (!precision) {
        cell.prepend(caption);
        return { cell };
      }

      precisions.add(precision);
      const links = Array.from(cell.querySelectorAll("a"));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-catalog-cell";
      button.setAttribute("aria-label", `${name}, ${backend}, ${precision}`);
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-pressed", "false");
      button.textContent = precision;

      const dash = document.createElement("span");
      dash.textContent = "—";
      dash.hidden = true;
      cell.replaceChildren(caption, button, dash);
      const recipe = { name, backend, precision, links, button, dash };
      button.addEventListener("click", () => selectRecipe(recipe));
      return { cell, recipe };
    });
    if (!families.has(familyName)) {
      const button = document.createElement("button");
      button.className = "model-catalog-family-button";
      button.type = "button";
      button.setAttribute("aria-controls", familyResults.id);
      const caption = document.createElement("span");
      caption.textContent = familyName;
      const count = document.createElement("small");
      button.append(caption, count);
      familyButtons.append(button);
      const family = { name: familyName, button, count, option: new Option(familyName, familyName), body: table.createTBody(), checkpoints: [] };
      button.addEventListener("click", () => chooseFamily(family));
      families.set(familyName, family);
    }
    const family = families.get(familyName);
    family.body.append(row);
    family.checkpoints.push({ row, name, cells });
  }
  if (sourceBody && !sourceBody.rows.length) sourceBody.remove();
  for (const precision of precisions) precisionFilter.add(new Option(precision, precision));

  let preferredFamily = families.get("Qwen3.8");
  let activeFamily;

  function quantity(count, singular, plural = singular + "s") {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function selectRecipe(recipe) {
    selected?.button.setAttribute("aria-pressed", "false");
    selected = recipe;
    panel.hidden = !recipe;
    selectedLinks.replaceChildren(...(recipe?.links ?? []));
    if (!recipe) return;

    recipe.button.setAttribute("aria-pressed", "true");
    selectedCheckpoint.textContent = recipe.name;
    selectedDetails.textContent = `${recipe.backend} · ${recipe.precision}`;
  }

  function showFamily(family) {
    activeFamily = family;
    for (const group of families.values()) {
      group.body.hidden = group !== family;
      group.button.setAttribute("aria-pressed", String(group === family));
    }
    if (family) {
      familySelect.value = family.name;
      familyHeading.textContent = family.name;
      familyCount.textContent = quantity(family.checkpointCount, "checkpoint");
    }
    if (!family?.matches.includes(selected)) selectRecipe(family?.matches[0] ?? null);
  }

  function chooseFamily(family) {
    preferredFamily = family;
    showFamily(family);
  }

  function updateFilters() {
    const query = search.value.trim().toLowerCase();
    const backend = backendFilter.value;
    const precision = precisionFilter.value;
    const visibleColumns = columns.map(({ cell, backend: label }) => {
      const visible = !backend || label === backend;
      cell.hidden = !visible;
      return visible;
    });
    matrix.toggleAttribute("data-single-backend", Boolean(backend));
    const offeredFamilies = [];
    let checkpointCount = 0;
    let recipeCount = 0;

    for (const family of families.values()) {
      const familyMatchesQuery = family.name.toLowerCase().includes(query);
      const matches = [];
      let visibleCheckpoints = 0;

      for (const checkpoint of family.checkpoints) {
        const matchesQuery = familyMatchesQuery || checkpoint.name.toLowerCase().includes(query);
        const countBefore = matches.length;
        checkpoint.cells.forEach(({ cell, recipe }, index) => {
          cell.hidden = !visibleColumns[index];
          if (!recipe) return;

          const visible = matchesQuery && !cell.hidden && (!precision || recipe.precision === precision);
          recipe.button.hidden = !visible;
          recipe.dash.hidden = visible;
          if (visible) matches.push(recipe);
        });
        checkpoint.row.hidden = matches.length === countBefore;
        if (!checkpoint.row.hidden) visibleCheckpoints++;
      }

      family.matches = matches;
      family.checkpointCount = visibleCheckpoints;
      family.button.hidden = !visibleCheckpoints;
      if (!visibleCheckpoints) continue;

      family.count.textContent = quantity(visibleCheckpoints, "checkpoint");
      family.option.textContent = `${family.name} (${visibleCheckpoints})`;
      offeredFamilies.push(family);
      checkpointCount += visibleCheckpoints;
      recipeCount += matches.length;
    }

    familySelect.replaceChildren(...offeredFamilies.map(family => family.option));
    empty.hidden = offeredFamilies.length > 0;
    navigator.hidden = !empty.hidden;
    status.textContent = [
      quantity(offeredFamilies.length, "family", "families"),
      quantity(checkpointCount, "checkpoint"),
      quantity(recipeCount, "launch option"),
    ].join(" · ");
    showFamily(offeredFamilies.includes(preferredFamily) ? preferredFamily
      : offeredFamilies.includes(activeFamily) ? activeFamily : offeredFamilies[0]);
  }

  search.addEventListener("input", updateFilters);
  backendFilter.addEventListener("change", updateFilters);
  precisionFilter.addEventListener("change", updateFilters);
  familySelect.addEventListener("change", () => chooseFamily(families.get(familySelect.value)));
  familyResults.append(matrix);
  matrix.classList.add("is-interactive");
  updateFilters();
  catalog.hidden = false;
})();
