(() => {
  const explorer = document.querySelector("[data-contraction-explorer]");
  if (!explorer) return;

  const steps = explorer.querySelector(".contraction-steps");
  const stages = steps.querySelectorAll("[data-select-stage]");
  const input = Array.from(explorer.querySelectorAll("[data-input]"), cell => Number(cell.textContent));
  const rows = Array.from(explorer.querySelectorAll("tbody tr"), row => {
    const weights = Array.from(row.querySelectorAll("[data-weight]"), (cell, column) => {
      const value = Number(cell.textContent);
      const feature = input[column];
      const product = value * feature;
      const operands = document.createElement("span");
      operands.className = "contraction-operands";
      operands.textContent = `${value} × ${feature}`;
      return { cell, value, product, operands };
    });
    return {
      weights,
      result: row.querySelector("[data-result]"),
      sum: weights.reduce((total, weight) => total + weight.product, 0),
    };
  });
  const lines = explorer.querySelectorAll("[data-line]");
  const status = explorer.querySelector(".contraction-status");
  const matchingRule = explorer.querySelector("[data-matching-rule]");
  const axes = Array.from(explorer.querySelectorAll("[data-select-axis]"), header => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "contraction-axis";
    button.append(header.firstElementChild);
    header.append(button);
    return { button, axis: header.dataset.selectAxis };
  });

  let stage = "inspect";
  let axis = "feature";

  function render() {
    const inspecting = stage === "inspect";
    const summed = stage === "sum";
    explorer.dataset.stage = stage;
    explorer.dataset.axis = axis;
    matchingRule.hidden = stage !== "multiply";

    for (const button of stages) {
      button.setAttribute("aria-pressed", String(button.dataset.selectStage === stage));
    }
    for (const entry of axes) {
      entry.button.setAttribute("aria-pressed", String(entry.axis === axis));
    }
    for (const line of lines) {
      const name = line.dataset.line;
      const active = inspecting
        ? name === "weights" || (name === "input" && axis === "feature")
        : name === "dot";
      line.toggleAttribute("data-active", active);
    }

    for (const { weights, result, sum } of rows) {
      for (const { cell, value, product, operands } of weights) {
        cell.textContent = inspecting ? value : product;
        if (!inspecting) cell.prepend(operands);
      }
      result.textContent = summed ? sum : "–";
      result.setAttribute("aria-label", summed ? String(sum) : "Result pending");
    }

    if (inspecting) {
      status.textContent = axis === "feature"
        ? "Weights .feature · Rank 2 · Axis 1 · Size 3"
        : "Weights .output · Rank 2 · Axis 0 · Size 2";
    } else if (summed) {
      status.textContent = "Result f32[2] · .output · Rank 1";
    } else {
      status.textContent = ".feature · Weights axis 1 · Input axis 0 · Size\u00a03";
    }
  }

  for (const button of stages) {
    button.addEventListener("click", () => {
      stage = button.dataset.selectStage;
      if (stage !== "inspect") axis = "feature";
      render();
    });
  }
  for (const entry of axes) {
    entry.button.addEventListener("click", () => {
      stage = "inspect";
      axis = entry.axis;
      render();
    });
  }

  render();
  steps.hidden = false;
})();
