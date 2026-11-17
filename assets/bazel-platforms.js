(() => {
  const backends = [
    ["cpu", "CPU"],
    ["cuda", "NVIDIA CUDA", "Linux x86-64 or ARM64 with a compatible NVIDIA GPU and driver."],
    ["rocm", "AMD ROCm", "Linux x86-64 with a compatible AMD GPU and access to /dev/kfd and /dev/dri."],
    ["oneapi", "Intel oneAPI", "Linux x86-64 with a compatible Intel GPU and Level Zero driver."],
    ["tpu", "Google TPU", "Linux x86-64 on a Google Cloud TPU VM."],
    ["neuron", "AWS Neuron", "Linux x86-64 on an EC2 Neuron instance with access to /dev/neuron0."],
    ["metal", "Apple Metal", "macOS on Apple Silicon."],
    ["furiosa", "Furiosa", "Linux x86-64 with a Furiosa accelerator and its device runtime."],
  ];

  for (const [index, selector] of document.querySelectorAll(".bazel-platforms[data-bazel-target]").entries()) {
    const host = selector.querySelector(".bazel-platform-host");
    const cpuHost = host.textContent;
    const cpuShell = selector.querySelector(".bazel-platform-shell");
    let activeShell = cpuShell;

    const tabs = document.createElement("fieldset");
    tabs.className = "bazel-platform-tabs";
    const legend = document.createElement("legend");
    legend.textContent = "Backend";
    tabs.append(legend);

    // Create the variants before the deferred copy and highlighting scripts run.
    for (const [backend, name, requirements] of backends) {
      const isCpu = backend === "cpu";
      const shell = isCpu ? cpuShell : cpuShell.cloneNode(true);
      if (!isCpu) {
        const args = [
          `--@zml//platforms:${backend}=true`,
          "--@zml//platforms:cpu=false",
          selector.dataset.bazelTarget,
        ];
        const continuation = " \\" + "\n  ";
        shell.querySelector("code").textContent = ["build", "run"]
          .map(verb => [`bazel ${verb}`, ...args].join(continuation))
          .join("\n\n") + "\n";
        shell.hidden = true;
        selector.append(shell);
      }

      const tab = document.createElement("label");
      tab.className = "bazel-platform-tab";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `bazel-backend-${index}`;
      input.value = backend;
      input.checked = isCpu;
      const caption = document.createElement("span");
      caption.textContent = name;
      tab.append(input, caption);
      tabs.append(tab);

      input.addEventListener("change", () => {
        activeShell.hidden = true;
        shell.hidden = false;
        activeShell = shell;
        host.textContent = isCpu ? cpuHost : `${requirements} CPU fallback disabled.`;
      });
    }

    selector.prepend(tabs);
  }
})();
