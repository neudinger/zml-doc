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

    function showPlatformOptions() {
      const selected = control.querySelector("input:checked");
      for (const panel of panels) panel.hidden = panel.dataset.cliOption !== selected.value;
    }

    control.addEventListener("change", showPlatformOptions);
    control.hidden = false;
    showPlatformOptions();
  }
})();
