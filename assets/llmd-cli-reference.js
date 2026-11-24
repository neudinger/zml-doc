(() => {
  const workload = document.querySelector("[data-cli-workload]");
  if (workload) {
    const inputs = workload.querySelector("[data-workload-inputs]");
    const sequences = inputs.querySelector("[name='sequences']");
    const context = inputs.querySelector("[name='context']");
    const error = workload.querySelector("[role='alert']");
    const results = workload.querySelector("[data-workload-results]");
    const pageCount = workload.querySelector("[data-workload-pages]");
    const equation = workload.querySelector("[data-workload-equation]");
    const flags = workload.querySelector("[data-workload-flags]");
    const tokensPerPage = 16;
    const format = new Intl.NumberFormat("en-US");

    function updateWorkload() {
      const invalid = [];
      for (const field of [sequences, context]) {
        if (field.validity.valid) {
          field.removeAttribute("aria-invalid");
        } else {
          field.setAttribute("aria-invalid", "true");
          invalid.push(field);
        }
      }

      error.hidden = invalid.length === 0;
      results.hidden = invalid.length !== 0;
      error.textContent = invalid.map(field => {
        const bounds = format.format(Number(field.min)) + "–" + format.format(Number(field.max));
        return "Enter " + bounds + " whole " + (field === sequences ? "active sequences." : "tokens per sequence.");
      }).join(" ");
      if (invalid.length) return;

      const active = sequences.valueAsNumber;
      const tokens = context.valueAsNumber;
      const pages = active * Math.ceil(tokens / tokensPerPage);
      pageCount.textContent = format.format(pages);
      equation.textContent = `${active} × ⌈${format.format(tokens)} tokens ÷ ${tokensPerPage} tokens/page⌉`;
      const command = `--batch-size=${active} --max-context-len=${tokens}`;
      if (flags.textContent === command) return;
      flags.textContent = command;
      flags.dispatchEvent(new Event("codechange", { bubbles: true }));
    }

    inputs.hidden = false;
    inputs.addEventListener("input", updateWorkload);
    updateWorkload();
  }

  const options = document.querySelector("[data-cli-options]");
  if (options) {
    const control = options.querySelector("[data-cli-option-control]");
    const panels = options.querySelectorAll("[data-cli-option]");
    const choices = Array.from(control.querySelectorAll('input[type="radio"]'));

    function showOptions() {
      const selected = choices.find(choice => choice.checked);
      for (const panel of panels) panel.hidden = panel.dataset.cliOption !== selected.value;
    }

    function revealOption(hash) {
      const target = document.getElementById(hash.slice(1));
      const panel = target?.closest("[data-cli-option]");
      if (!panel || !options.contains(panel)) return null;
      const choice = choices.find(input => input.value === panel.dataset.cliOption);
      if (!choice || choice.checked) return null;
      choice.checked = true;
      showOptions();
      return target;
    }

    control.addEventListener("change", showOptions);
    // Reveal the destination before the browser follows a same-page link.
    document.addEventListener("click", event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      revealOption(link.hash);
    }, { capture: true });
    window.addEventListener("hashchange", () => revealOption(location.hash)?.scrollIntoView());

    const initialTarget = revealOption(location.hash);
    control.hidden = false;
    showOptions();
    if (initialTarget) requestAnimationFrame(() => initialTarget.scrollIntoView());
  }
})();
