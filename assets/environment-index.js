(() => {
  const index = document.querySelector(".environment-index");
  if (!index) return;

  const groupControls = index.querySelector(".environment-index-groups");
  const variableControls = index.querySelector(".environment-index-names");
  const launchControls = index.querySelector(".environment-index-launch-controls");
  const modeButtons = Array.from(launchControls?.querySelectorAll("[data-launch-mode]") ?? []);
  const groups = Array.from(index.querySelectorAll(".environment-index-group"), panel => ({
    label: panel.dataset.group,
    heading: panel.querySelector("h2"),
    panel,
    variables: Array.from(panel.querySelectorAll(".environment-index-record"), record => ({
      label: record.querySelector("h3 code").textContent,
      heading: record.querySelector("h3"),
      panel: record,
      launchHeading: record.querySelector(".environment-index-launch-heading"),
      launchPanels: Array.from(record.querySelectorAll("[data-environment-mode]")),
    })),
  }));
  if (!groups.length || groups.some(group => !group.variables.length)) return;

  const bookmarks = new Map();
  let activeGroup;
  let activeVariable;
  let launchMode = modeButtons[0]?.dataset.launchMode;

  function choice(label, panel, activate) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-controls", panel.id);
    button.addEventListener("click", activate);
    return button;
  }

  function showLaunchExample() {
    if (!launchControls) return;
    const { launchHeading, launchPanels } = activeVariable;
    launchControls.hidden = !launchHeading;
    if (!launchHeading) return;
    if (launchControls.parentElement !== launchHeading) launchHeading.append(launchControls);

    for (const panel of launchPanels) panel.hidden = panel.dataset.environmentMode !== launchMode;
    for (const button of modeButtons) {
      const panel = launchPanels.find(entry => entry.dataset.environmentMode === button.dataset.launchMode);
      button.setAttribute("aria-pressed", String(!panel.hidden));
      button.setAttribute("aria-controls", panel.id);
    }
  }

  function select(group, variable = group.variables[0], mode = launchMode) {
    if (activeGroup !== group) {
      activeGroup = group;
      for (const entry of groups) {
        entry.panel.hidden = entry !== group;
        entry.button.setAttribute("aria-pressed", String(entry === group));
      }
      variableControls.replaceChildren(...group.variables.map(entry => entry.button));
    }
    for (const entry of group.variables) {
      entry.panel.hidden = entry !== variable;
      entry.button.setAttribute("aria-pressed", String(entry === variable));
    }
    activeVariable = variable;
    launchMode = mode;
    showLaunchExample();
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      launchMode = button.dataset.launchMode;
      showLaunchExample();
      const panel = activeVariable.launchPanels.find(entry => entry.dataset.environmentMode === launchMode);
      history.replaceState(history.state, "", "#" + panel.querySelector("h4").id);
    });
  }

  function choose(group, variable) {
    select(group, variable);
    const hash = "#" + (variable ?? group).heading.id;
    history.replaceState(history.state, "", hash);
  }

  for (const group of groups) {
    group.panel.id = group.heading.id + "-group";
    group.button = choice(group.label, group.panel, () => choose(group));
    groupControls.append(group.button);
    bookmarks.set("#" + group.heading.id, { group, anchor: group.heading });
    for (const variable of group.variables) {
      variable.panel.id = variable.heading.id + "-record";
      variable.button = choice(variable.label, variable.panel, () => choose(group, variable));
      for (const anchor of variable.panel.querySelectorAll("[id]")) {
        const mode = anchor.closest("[data-environment-mode]")?.dataset.environmentMode;
        bookmarks.set("#" + anchor.id, { group, variable, mode, anchor });
      }
    }
  }

  function reveal(hash) {
    const target = bookmarks.get(hash);
    if (!target) return null;
    select(target.group, target.variable, target.mode);
    return target.anchor;
  }

  // Make fragment targets visible before the browser follows on-page links.
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    reveal(link.hash);
  }, { capture: true });
  window.addEventListener("hashchange", () => {
    const target = bookmarks.get(location.hash);
    if (!target) return;
    const wasVisible = target.anchor.getClientRects().length > 0;
    reveal(location.hash);
    if (!wasVisible) target.anchor.scrollIntoView();
  });

  const initialTarget = reveal(location.hash);
  if (!initialTarget) {
    const initial = bookmarks.get("#env-" + index.dataset.initialVariable);
    select(initial?.group ?? groups[0], initial?.variable);
  }
  index.classList.add("is-enhanced");
  groupControls.hidden = false;
  variableControls.hidden = false;
  if (initialTarget) requestAnimationFrame(() => initialTarget.scrollIntoView());
})();
