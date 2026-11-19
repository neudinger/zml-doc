import { compareCheckpoints, compareNames, modelFamily } from "./llmd-model-families.js";

(() => {
  const catalog = document.querySelector("[data-model-catalog]");
  const matrix = document.querySelector(".model-catalog-table");
  const table = matrix?.querySelector("table");
  if (!catalog || !table) return;

  const search = catalog.querySelector('input[name="checkpoint"]');
  const capabilityFilter = catalog.querySelector('select[name="capability"]');
  const backendFilter = catalog.querySelector('select[name="backend"]');
  const precisionFilter = catalog.querySelector('select[name="precision"]');
  const pairingsOnly = catalog.querySelector('input[name="pairings"]');
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
  const routineControls = panel.querySelector("[data-model-routine]");
  const requestSelect = panel.querySelector('select[name="request"]');
  const decodingSelect = panel.querySelector('select[name="decoding"]');
  const drafterSelect = panel.querySelector('select[name="drafter"]');
  const configureLink = panel.querySelector("[data-model-configure]");
  const drafterDetails = panel.querySelector("[data-model-drafter]");
  let selected = null;

  const [header, ...rows] = Array.from(table.rows);
  const sourceBody = rows[0]?.parentElement;
  const backends = {
    "NVIDIA CUDA": { key: "cuda", short: "CUDA" },
    "AMD ROCm": { key: "rocm", short: "ROCm" },
    "Apple Metal": { key: "metal", short: "Metal" },
    "Intel oneAPI": { key: "oneapi", short: "oneAPI" },
    "Google TPU": { key: "tpu", short: "TPU" },
    "Furiosa RNGD": { key: "furiosa", short: "RNGD" },
  };
  table.setAttribute("aria-label", "Model compatibility by backend");
  table.setAttribute("role", "table");
  table.createTHead().append(header);
  header.cells[0].scope = "col";
  header.cells[1].remove();
  const columns = Array.from(header.cells).slice(1).map(cell => {
    const backend = cell.textContent.trim();
    cell.scope = "col";
    cell.textContent = backends[backend].short;
    cell.setAttribute("aria-label", backend);
    backendFilter.add(new Option(backend, backend));
    return { cell, backend };
  });

  // Join the static capability tables and published recipes by exact checkpoint ID.
  const sources = new Map([
    ["chat", document.querySelector("[data-llmd-routine-list]")],
    ...Array.from(document.querySelectorAll("[data-llmd-capability-list]"), section => [section.dataset.request, section]),
    ["pairings", document.querySelector("[data-llmd-pairings]")],
  ]);
  const profiles = new Map();
  const existing = new Set(rows.map(row => row.cells[0].textContent.trim()));
  function backendLinks(container) {
    return new Map(Array.from(container.querySelectorAll("a[data-backend]"), link => [link.dataset.backend, link.href]));
  }
  for (const [request, section] of sources) {
    for (const source of section.querySelectorAll("tr[data-checkpoint]")) {
      const { checkpoint, family, precision } = source.dataset;
      const profile = profiles.get(checkpoint) ?? { modes: [], drafters: [], requestLinks: new Map() };
      if (precision) profile.precision = precision;
      if (request === "chat") {
        profile.modes = Array.from(source.querySelectorAll("details[data-decoding]"), details => ({
          id: details.dataset.decoding,
          label: details.querySelector("summary").textContent.trim(),
          drafter: details.dataset.drafter,
          links: backendLinks(details),
        }));
      } else if (request === "pairings") {
        profile.drafters = Array.from(source.querySelectorAll("li[data-drafter]"), item => ({
          id: item.dataset.drafter,
          links: backendLinks(item),
        }));
      } else {
        profile.requestLinks.set(request, backendLinks(source));
      }
      profiles.set(checkpoint, profile);
      if (existing.has(checkpoint)) continue;

      existing.add(checkpoint);
      const row = document.createElement("tr");
      const code = document.createElement("code");
      code.textContent = checkpoint;
      const link = source.cells[0].querySelector("a")?.cloneNode(false);
      link?.append(code);
      row.insertCell().append(link ?? code);
      row.insertCell().textContent = family;
      columns.forEach(() => { row.insertCell().textContent = "—"; });
      rows.push(row);
    }
  }

  const families = new Map();
  const precisions = new Set();
  const models = rows.map(row => {
    const series = row.cells[1].textContent.trim();
    return { row, name: row.cells[0].textContent.trim(), series, familyName: modelFamily(series) || "Other models" };
  });
  models.sort((a, b) => compareNames(a.familyName, b.familyName) || compareCheckpoints(a.name, b.name));
  for (const { row, name, series, familyName } of models) {
    const [label, familyCell, ...backendCells] = Array.from(row.cells);
    const profile = profiles.get(name);
    familyCell.remove();
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.append(...label.childNodes);
    label.replaceWith(heading);
    const cells = backendCells.map((cell, index) => {
      const { backend } = columns[index];
      const caption = document.createElement("span");
      caption.className = "model-catalog-backend";
      const { key, short } = backends[backend];
      caption.textContent = short;
      caption.setAttribute("aria-hidden", "true");
      const modes = profile?.modes.filter(mode => mode.links.has(key)) ?? [];
      const drafters = (profile?.drafters ?? []).filter(drafter => drafter.links.has(key));
      if (drafters.length && !modes.some(mode => mode.id === "external")) {
        modes.push({ id: "external", label: "External drafter" });
      }
      const links = Array.from(cell.querySelectorAll("a"));
      const requests = new Map();
      for (const [request, launchLinks] of profile?.requestLinks ?? []) {
        if (launchLinks.has(key)) requests.set(request, launchLinks.get(key));
      }
      if (modes.length || links.length) requests.set("chat", null);
      if (!requests.size) {
        cell.prepend(caption);
        return { cell };
      }

      const precision = cell.querySelector("code")?.textContent.trim() || profile?.precision || "Unspecified";
      precisions.add(precision);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-catalog-cell";
      const pairingOnly = drafters.length && !links.length && !modes.some(mode => mode.links) && requests.size === 1;
      button.setAttribute("aria-label", `${name}, ${backend}, ${precision}${pairingOnly ? ", reported drafter pairing" : ""}`);
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-pressed", "false");
      button.textContent = pairingOnly ? "Pairing" : precision === "Unspecified" ? "Target" : precision;

      const dash = document.createElement("span");
      dash.textContent = "—";
      dash.hidden = true;
      cell.replaceChildren(caption, button, dash);
      const recipe = { name, backend, key, precision, modes, drafters, links, button, dash, requests };
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
    family.checkpoints.push({ row, name, series, cells });
  }
  if (sourceBody && !sourceBody.rows.length) sourceBody.remove();
  for (const precision of precisions) precisionFilter.add(new Option(precision, precision));

  let preferredFamily = families.values().next().value;
  let activeFamily;

  function quantity(count, singular, plural = singular + "s") {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function selectRecipe(recipe) {
    const previousMode = selected?.name === recipe?.name ? decodingSelect.value : "standard";
    const previousRequest = selected?.name === recipe?.name ? requestSelect.value : "";
    const previousDrafter = selected?.name === recipe?.name ? drafterSelect.value : "";
    selected?.button.setAttribute("aria-pressed", "false");
    selected = recipe;
    panel.hidden = !recipe;
    selectedLinks.replaceChildren(...(recipe?.links ?? []));
    if (!recipe) return;

    recipe.button.setAttribute("aria-pressed", "true");
    selectedCheckpoint.textContent = recipe.name;
    const requestOptions = [...capabilityFilter.options].filter(option => recipe.requests.has(option.value));
    requestSelect.replaceChildren(...requestOptions.map(option => option.cloneNode(true)));
    const preferred = capabilityFilter.value || previousRequest;
    requestSelect.value = recipe.requests.has(preferred) ? preferred : recipe.requests.keys().next().value;
    requestSelect.parentElement.hidden = recipe.requests.size < 2 || Boolean(capabilityFilter.value);
    decodingSelect.replaceChildren(...recipe.modes.map(mode => new Option(mode.label, mode.id)));
    drafterSelect.replaceChildren(...recipe.drafters.map(drafter => new Option(drafter.id, drafter.id)));
    const query = search.value.trim().toLowerCase();
    const matches = query && !recipe.name.toLowerCase().includes(query)
      ? recipe.drafters.filter(drafter => drafter.id.toLowerCase().includes(query)) : [];
    const matchingDrafter = matches.find(drafter => drafter.id.toLowerCase() === query)
      ?? matches.find(drafter => drafter.id === previousDrafter) ?? matches[0];
    const preferredDrafter = matchingDrafter?.id || previousDrafter || recipe.modes.find(mode => mode.id === "external")?.drafter;
    if (recipe.drafters.some(drafter => drafter.id === preferredDrafter)) drafterSelect.value = preferredDrafter;
    if (matchingDrafter || pairingsOnly.checked) decodingSelect.value = "external";
    else if (recipe.modes.some(mode => mode.id === previousMode)) decodingSelect.value = previousMode;
    updateLaunch();
  }

  function updateLaunch() {
    const chat = requestSelect.value === "chat";
    const label = requestSelect.selectedOptions[0].textContent;
    const mode = chat ? selected.modes.find(mode => mode.id === decodingSelect.value) : null;
    const pairing = mode?.id === "external" ? selected.drafters.find(drafter => drafter.id === drafterSelect.value) : null;
    let context = "Documented preset";
    if (!chat) context = label + " request · Backend validation pending";
    else if (pairing && pairing.id !== mode.drafter) context = "Reported pairing · Verify on this backend";
    else if (mode) context = "Routine test target";
    const weights = selected.precision === "Unspecified" ? "Weight precision unspecified" : selected.precision;
    selectedDetails.textContent = `${selected.backend} · ${weights} · ${context}`;
    decodingSelect.parentElement.hidden = !chat || !selected.modes.length;
    drafterSelect.parentElement.hidden = !pairing;
    selectedLinks.hidden = !chat || !selected.links.length;
    const launch = chat ? (pairing?.links ?? mode?.links)?.get(selected.key) : selected.requests.get(requestSelect.value);
    configureLink.hidden = !launch;
    routineControls.hidden = requestSelect.parentElement.hidden && !launch;
    if (launch) {
      configureLink.href = launch;
      configureLink.setAttribute("aria-label", `Configure launch for ${selected.name} on ${selected.backend}, ${pairing?.id ?? mode?.label ?? label}`);
    }
    const drafter = pairing?.id ?? mode?.drafter;
    drafterDetails.textContent = drafter || "";
    drafterDetails.hidden = !drafter;
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
      familyCount.textContent = quantity(family.checkpointCount, "model");
    }
    selectRecipe(family?.matches.includes(selected) ? selected : family?.matches[0] ?? null);
  }

  function chooseFamily(family) {
    preferredFamily = family;
    showFamily(family);
  }

  function updateFilters() {
    const query = search.value.trim().toLowerCase();
    const backend = backendFilter.value;
    const precision = precisionFilter.value;
    const capability = capabilityFilter.value;
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
        const checkpointMatches = familyMatchesQuery || checkpoint.name.toLowerCase().includes(query)
          || checkpoint.series.toLowerCase().includes(query);
        const countBefore = matches.length;
        checkpoint.cells.forEach(({ cell, recipe }, index) => {
          cell.hidden = !visibleColumns[index];
          if (!recipe) return;

          const matchesCapability = !capability || recipe.requests.has(capability);
          const matchesQuery = checkpointMatches || recipe.drafters.some(drafter => drafter.id.toLowerCase().includes(query));
          const visible = matchesQuery && !cell.hidden && matchesCapability && (!precision || recipe.precision === precision)
            && (!pairingsOnly.checked || recipe.drafters.length > 0);
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

      family.count.textContent = String(visibleCheckpoints);
      family.button.setAttribute("aria-label", `${family.name}, ${quantity(visibleCheckpoints, "model")}`);
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
      quantity(checkpointCount, "model"),
      quantity(recipeCount, "model/backend pair"),
    ].join(" · ");
    showFamily(offeredFamilies.includes(preferredFamily) ? preferredFamily
      : offeredFamilies.includes(activeFamily) ? activeFamily : offeredFamilies[0]);
  }

  search.addEventListener("input", updateFilters);
  capabilityFilter.addEventListener("change", updateFilters);
  backendFilter.addEventListener("change", updateFilters);
  precisionFilter.addEventListener("change", updateFilters);
  pairingsOnly.addEventListener("change", updateFilters);
  decodingSelect.addEventListener("change", updateLaunch);
  drafterSelect.addEventListener("change", updateLaunch);
  requestSelect.addEventListener("change", updateLaunch);
  familySelect.addEventListener("change", () => chooseFamily(families.get(familySelect.value)));
  familyResults.append(matrix);
  matrix.classList.add("is-interactive");
  // Keep indexed fragment links pointing to the visible catalog after enhancement.
  const fragments = new Map();
  for (const [capability, section] of sources) {
    const heading = section.querySelector("h2[id]");
    const anchor = document.createElement("span");
    anchor.id = heading.id;
    heading.removeAttribute("id");
    catalog.prepend(anchor);
    fragments.set(anchor.id, capability);
    section.hidden = true;
  }
  catalog.hidden = false;
  function followFragment() {
    const id = location.hash.slice(1);
    if (!fragments.has(id)) return;
    const capability = fragments.get(id);
    capabilityFilter.value = capability === "pairings" ? "chat" : capability === "chat" ? "" : capability;
    pairingsOnly.checked = capability === "pairings";
    updateFilters();
    document.getElementById(id).scrollIntoView();
  }
  updateFilters();
  followFragment();
  window.addEventListener("hashchange", followFragment);
})();
