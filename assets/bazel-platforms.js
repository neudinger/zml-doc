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

  const continuation = " \\" + "\n  ";
  for (const target of document.querySelectorAll(".bazel-platforms [data-bazel-target]")) {
    const recipe = target.closest(".bazel-platforms");
    const field = recipe.querySelector(".bazel-backend");
    const picker = field.querySelector("select");
    const host = recipe.querySelector(".bazel-platform-host");
    const cpuHost = host.textContent;
    const commands = recipe.querySelectorAll("[data-bazel-command]");

    for (const [backend, name] of backends) {
      picker.add(new Option(name, backend));
    }

    picker.addEventListener("change", () => {
      const [backend, , requirements] = backends[picker.selectedIndex];
      const flags = [`--@zml//platforms:${backend}=true`];
      if (backend !== "cpu") flags.push("--@zml//platforms:cpu=false");
      host.textContent = requirements ? `${requirements} CPU fallback disabled.` : cpuHost;

      for (const code of commands) {
        code.textContent = [`bazel ${code.dataset.bazelCommand}`, ...flags, target.dataset.bazelTarget].join(continuation) + "\n";
        code.dispatchEvent(new Event("codechange", { bubbles: true }));
      }
    });
    field.hidden = false;
  }
})();
