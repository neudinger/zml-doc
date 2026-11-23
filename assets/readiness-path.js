(() => {
  const path = document.querySelector("[data-readiness-path]");
  const controls = path?.querySelector("[data-readiness-controls]");
  if (!controls) return;

  const steps = Array.from(controls.querySelectorAll("button[data-readiness-step]"), button => {
    const stage = document.getElementById(button.getAttribute("aria-controls"));
    if (!stage || !path.contains(stage) || stage.dataset.readinessStage !== button.dataset.readinessStep) return null;
    const choices = stage.querySelector("[data-readiness-choices]");
    const title = stage.querySelector("h3")?.textContent.trim();
    const symptoms = Array.from(stage.querySelectorAll("section[data-readiness-symptom][id]"), panel => ({
      panel,
      title: panel.querySelector("h4")?.textContent.trim(),
    }));
    if (!choices || !title || !symptoms.length || symptoms.some(symptom => !symptom.title)) return null;
    return { button, stage, choices, title, symptoms, selected: symptoms[0] };
  });
  if (!steps.length || steps.some(step => !step)) return;

  const status = document.createElement("p");
  status.className = "readiness-status";
  status.setAttribute("role", "status");
  path.append(status);

  for (const step of steps) {
    const label = document.createElement("p");
    label.className = "readiness-choices-label";
    label.textContent = "Related symptoms";
    label.setAttribute("aria-hidden", "true");
    step.choices.setAttribute("role", "group");
    step.choices.setAttribute("aria-label", label.textContent);
    step.choices.append(label);

    for (const symptom of step.symptoms) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = symptom.title;
      button.dataset.readinessChoice = symptom.panel.id;
      button.setAttribute("aria-controls", symptom.panel.id);
      button.addEventListener("click", () => select(step, symptom, true));
      symptom.button = button;
      step.choices.append(button);
    }
    step.button.addEventListener("click", () => select(step, step.selected, true));
    step.choices.hidden = false;
  }

  function select(step, symptom, announce = false) {
    step.selected = symptom;
    for (const candidate of steps) {
      const active = candidate === step;
      candidate.stage.hidden = !active;
      candidate.button.setAttribute("aria-pressed", String(active));
      for (const choice of candidate.symptoms) {
        const selected = choice === candidate.selected;
        choice.panel.hidden = !selected;
        choice.button.setAttribute("aria-pressed", String(selected));
      }
    }
    status.textContent = announce ? `${step.title}. Showing ${symptom.title}.` : "";
  }

  function fragmentTarget(hash) {
    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  }

  function reveal(target) {
    if (!target) return false;
    const step = steps.find(candidate => candidate.stage.contains(target));
    if (!step) return false;
    select(step, step.symptoms.find(symptom => symptom.panel.contains(target)) ?? step.selected);
    return true;
  }

  function followFragment() {
    const target = fragmentTarget(location.hash);
    if (reveal(target)) target.scrollIntoView();
  }

  select(steps[0], steps[0].selected);
  path.classList.add("is-enhanced");
  controls.hidden = false;
  followFragment();
  window.addEventListener("hashchange", followFragment);
  window.addEventListener("pageshow", event => {
    if (event.persisted) followFragment();
  });

  // Reveal fragment destinations before native scrolling, including repeat clicks on the same hash.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = fragmentTarget(link.hash);
    if (reveal(target) && path.contains(link)) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }, true);
})();
