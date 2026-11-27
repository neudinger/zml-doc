import { compareCheckpoints, compareNames, modelFamily } from "./llmd-model-families.js";

(() => {
  const catalog = document.querySelector("[data-model-catalog]");
  const matrix = document.querySelector(".model-catalog-table");
  const table = matrix?.querySelector("table");
  // Source links open the exact entry in the server-rendered records.
  if (!catalog || !table || new URLSearchParams(location.search).get("view") === "records") return;

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
  const modelSelect = navigator.querySelector('select[name="catalog-model"]');
  const familyResults = navigator.querySelector("#model-catalog-family");
  const familyHeading = familyResults.querySelector("#model-catalog-family-heading");
  const familyCount = familyResults.querySelector("[data-model-family-count]");
  const panel = catalog.querySelector(".model-catalog-recipe");
  const selectedCheckpoint = panel.querySelector("[data-model-checkpoint]");
  const selectedDetails = panel.querySelector("[data-model-details]");
  const evidenceType = panel.querySelector("[data-model-evidence]");
  const evidenceNote = panel.querySelector("[data-model-note]");
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
  function recordLink(summary, label) {
    const link = document.createElement("a");
    link.href = "?view=records#" + encodeURIComponent(summary.id);
    link.textContent = label;
    return link;
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
          source: recordLink(details.querySelector("summary"), "Routine test record"),
        }));
      } else if (request === "pairings") {
        profile.drafters = Array.from(source.querySelectorAll("li[data-drafter]"), item => ({
          id: item.dataset.drafter,
          links: backendLinks(item),
          source: recordLink(item.querySelector("summary"), "Target and drafter record"),
        }));
      } else {
        profile.requestLinks.set(request, {
          links: backendLinks(source),
          source: recordLink(source.querySelector("summary"), "Model capability record"),
        });
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
      const preset = cell.querySelector("a.published-recipe, a.recorded-run, a.source-tested");
      const pairRuns = Array.from(cell.querySelectorAll("a.recorded-pair"));
      const presetSources = Array.from(cell.querySelectorAll("a")).filter(link => link !== preset && !pairRuns.includes(link));
      const requests = new Map();
      for (const [request, record] of profile?.requestLinks ?? []) {
        if (record.links.has(key)) requests.set(request, { launch: record.links.get(key), source: record.source });
      }
      if (modes.length || preset) requests.set("chat", null);
      if (!requests.size) {
        cell.prepend(caption);
        return { cell };
      }

      const precision = cell.querySelector("code")?.textContent.trim() || profile?.precision || "Unspecified";
      precisions.add(precision);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-catalog-cell";
      const pairingOnly = drafters.length && !preset && !modes.some(mode => mode.links) && requests.size === 1;
      button.setAttribute("aria-label", `${name}, ${backend}, ${precision}${pairingOnly ? ", reported drafter pairing" : ""}`);
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-pressed", "false");
      button.textContent = pairingOnly ? "Pairing" : precision === "Unspecified" ? "Target" : precision;

      const dash = document.createElement("span");
      dash.textContent = "—";
      dash.hidden = true;
      cell.replaceChildren(caption, button, dash);
      const recipe = { name, backend, key, precision, modes, drafters, preset, presetSources, pairRuns, button, dash, requests, row };
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
    family.checkpoints.push({ row, name, series, cells, option: new Option(name, name) });
  }
  if (sourceBody && !sourceBody.rows.length) sourceBody.remove();
  for (const precision of precisions) precisionFilter.add(new Option(precision, precision));

  let preferredFamily = families.values().next().value;
  let activeFamily;

  function quantity(count, singular, plural = singular + "s") {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function selectRecipe(recipe) {
    const previousMode = selected?.name === recipe?.name ? decodingSelect.value
      : recipe?.modes.some(mode => mode.id === "native") ? "native" : "standard";
    const previousRequest = selected?.name === recipe?.name ? requestSelect.value : "";
    const previousDrafter = selected?.name === recipe?.name ? drafterSelect.value : "";
    selected?.button.setAttribute("aria-pressed", "false");
    selected?.row.removeAttribute("data-selected-model");
    selected = recipe;
    panel.hidden = !recipe;
    if (!recipe) return;

    recipe.button.setAttribute("aria-pressed", "true");
    recipe.row.setAttribute("data-selected-model", "");
    modelSelect.value = recipe.name;
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

  function evidenceFor(recipe, mode, pairing, request) {
    if (request) return {
      type: "Request supported", note: "The model supports this request. A result for this backend is pending.",
      sources: [request.source], launch: request.launch,
    };
    const { preset, presetSources, key, backend } = recipe;
    const external = mode?.id === "external";
    const drafter = pairing?.id ?? mode?.drafter;
    const matchesPreset = preset && (external ? drafter && preset.classList.contains(drafter)
      : !preset.classList.contains("external") && (!mode || mode.id === "standard"));
    if (matchesPreset) {
      if (preset.classList.contains("source-tested")) return {
        type: "Upstream source test", note: "Upstream testing covered these weights on this backend. The generated Docker command awaits hardware validation.",
        sources: presetSources, launch: preset.href,
      };
      if (preset.classList.contains("recorded-run")) return {
        type: "Recorded run", note: "The linked result identifies the hardware and settings used with these weights.",
        sources: presetSources, launch: preset.href,
      };
      return {
        type: "Published recipe", note: external
          ? "Configure launch uses the drafter and settings in the published " + backend + " command."
          : "The release supplies a launch command for this model on " + backend + ".",
        sources: presetSources, launch: preset.href,
      };
    }
    const launch = (pairing?.links ?? mode.links).get(key);
    const run = pairing && recipe.pairRuns.find(link => link.classList.contains(pairing.id));
    if (run) return {
      type: "Recorded run", note: "The linked result covers this target and drafter on " + backend + ".",
      sources: [run], launch,
    };
    if (pairing && pairing.id !== mode.drafter) return {
      type: "Reported pairing", note: "The pairing list names this target and drafter. A passing run on " + backend + " is unconfirmed by this record.",
      sources: [pairing.source], launch,
    };
    return {
      type: "Routine test target", note: "The routine suite lists this configuration. A passing run on " + backend + " requires a separate result.",
      sources: [mode.source], launch,
    };
  }

  function updateLaunch() {
    const chat = requestSelect.value === "chat";
    const label = requestSelect.selectedOptions[0].textContent;
    const mode = chat ? selected.modes.find(option => option.id === decodingSelect.value) : null;
    const pairing = mode?.id === "external" ? selected.drafters.find(option => option.id === drafterSelect.value) : null;
    const evidence = evidenceFor(selected, mode, pairing, selected.requests.get(requestSelect.value));
    const weights = selected.precision === "Unspecified" ? "Weight precision unspecified" : selected.precision;
    selectedDetails.textContent = [selected.backend, weights, chat ? mode?.label ?? "Standard" : label].join(" · ");
    evidenceType.textContent = evidence.type;
    evidenceNote.textContent = evidence.note;
    selectedLinks.replaceChildren(...evidence.sources);
    decodingSelect.parentElement.hidden = !chat || !selected.modes.length;
    drafterSelect.parentElement.hidden = !pairing;
    routineControls.hidden = requestSelect.parentElement.hidden && decodingSelect.parentElement.hidden;
    configureLink.href = evidence.launch;
    configureLink.setAttribute("aria-label", `Configure launch for ${selected.name} on ${selected.backend}, ${pairing?.id ?? mode?.label ?? label}`);
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
    const visibleModels = family?.checkpoints.filter(model => !model.row.hidden) ?? [];
    modelSelect.replaceChildren(...visibleModels.map(model => model.option));
    const matches = family?.matches ?? [];
    selectRecipe(matches.includes(selected) ? selected : matches.find(recipe => recipe.name === selected?.name) ?? matches[0]);
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
    const filterCount = [capability, backend, precision, pairingsOnly.checked].filter(Boolean).length;
    catalog.querySelector("[data-model-filter-count]").textContent = filterCount ? " · " + filterCount : "";
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
  backendFilter.addEventListener("change", updateFilters);
  precisionFilter.addEventListener("change", updateFilters);
  decodingSelect.addEventListener("change", updateLaunch);
  drafterSelect.addEventListener("change", updateLaunch);
  requestSelect.addEventListener("change", updateLaunch);
  familySelect.addEventListener("change", () => chooseFamily(families.get(familySelect.value)));
  modelSelect.addEventListener("change", () => {
    const cells = activeFamily.matches.filter(recipe => recipe.name === modelSelect.value);
    selectRecipe(cells.find(recipe => recipe.key === selected?.key) ?? cells[0]);
  });
  familyResults.insertBefore(matrix, familyResults.querySelector("[data-catalog-legend]"));
  matrix.classList.add("is-interactive");
  // Keep indexed fragment links pointing to the visible catalog after enhancement.
  const fragments = new Map();
  const catalogHeading = "choose-a-checkpoint";
  for (const [capability, section] of sources) {
    const heading = section.querySelector("h2[id]");
    const anchor = document.createElement("span");
    anchor.id = heading.id;
    anchor.dataset.tocAlias = "";
    heading.removeAttribute("id");
    catalog.prepend(anchor);
    fragments.set(anchor.id, capability);
    section.hidden = true;
  }
  catalog.hidden = false;
  function applyFragment(id) {
    const view = fragments.get(id);
    if (!view && id !== catalogHeading) return;
    const pairings = view === "pairings";
    const capability = pairings ? "chat" : view && view !== "chat" ? view : "";
    if (capabilityFilter.value !== capability || pairingsOnly.checked !== pairings) {
      capabilityFilter.value = capability;
      pairingsOnly.checked = pairings;
      updateFilters();
    }
    return document.getElementById(id);
  }
  function followFragment(event) {
    const id = location.hash.slice(1);
    // Browser Back to the original catalog removes its filter bookmark.
    if (!id && event?.oldURL && fragments.has(new URL(event.oldURL).hash.slice(1))) applyFragment(catalogHeading);
    else applyFragment(id)?.scrollIntoView();
  }
  function changeView() {
    updateFilters();
    if (!fragments.has(location.hash.slice(1))) return;
    const url = new URL(location.href);
    url.hash = "";
    history.replaceState(history.state, "", url);
    catalog.dispatchEvent(new Event("model-catalog-viewchange", { bubbles: true }));
  }
  capabilityFilter.addEventListener("change", changeView);
  pairingsOnly.addEventListener("change", changeView);
  updateFilters();
  followFragment();
  window.addEventListener("hashchange", followFragment);
  // Apply before the outline focuses the destination, including same-hash clicks.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (link) applyFragment(link.hash.slice(1));
  }, true);
})();
