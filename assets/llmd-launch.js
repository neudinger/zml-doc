(() => {
  const backends = {
    metal: { requirements: "Use an Apple Silicon Mac with macOS Tahoe or later and Homebrew. On M1 and M2, use LLMD 20261112.0 or later." },
    cuda: { shm: "256GB", devices: [], requirements: "Use Linux with Docker, a supported NVIDIA GPU and driver, and NVIDIA Container Toolkit." },
    rocm: { shm: "256GB", devices: ["--device=/dev/kfd", "--device=/dev/dri"], requirements: "Use Linux with Docker, a supported AMD GPU and driver, and access to /dev/kfd and /dev/dri." },
    oneapi: { devices: ["--device=/dev/dri"], requirements: "Use Linux with Docker, a supported Intel GPU and driver, and access to /dev/dri." },
    tpu: {
      hostNetwork: true,
      devices: ["--privileged"],
      requirements: "Use an x86-64 Google TPU VM running Linux with Docker and access to its attached TPUs.",
    },
    furiosa: {
      devices: ["--device=furiosa.ai/npu=npu0", "--device=/dev/dma_heap/system", "--security-opt=seccomp=unconfined"],
      requirements: "Use Linux x86-64 with the Furiosa RNGD driver, Docker with CDI enabled, and /dev/dma_heap/system available on the host.",
    },
  };
  const lfm3Bf16DockerEvidence = "Tested upstream with BF16 weights. The Docker command is adapted from the published FP8 recipe.";
  const presets = [
    { id: "lfm3-fp8-metal", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "metal", batchSize: 4 },
    { id: "lfm3-fp8-cuda", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "cuda" },
    { id: "lfm3-fp8-rocm", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "rocm" },
    { id: "lfm3-bf16-metal", checkpoint: "LiquidAI/LFM3-1.7B", backend: "metal", batchSize: 1, evidence: "Benchmarked upstream with this BF16 checkpoint on M3 Max." },
    { id: "lfm3-bf16-cuda", checkpoint: "LiquidAI/LFM3-1.7B", backend: "cuda", evidence: lfm3Bf16DockerEvidence },
    { id: "lfm3-bf16-rocm", checkpoint: "LiquidAI/LFM3-1.7B", backend: "rocm", evidence: lfm3Bf16DockerEvidence },
    { id: "lfm3-oneapi", checkpoint: "LiquidAI/LFM3-1.7B", backend: "oneapi" },
    { id: "lfm3-tpu", checkpoint: "LiquidAI/LFM3-1.7B", backend: "tpu" },
    { id: "lfm3-furiosa", checkpoint: "LiquidAI/LFM3-1.7B", backend: "furiosa", batchSize: 1, evidence: "Tested upstream on Furiosa. Docker recipe pending hardware validation." },
    { id: "qwen3-8-27b-fp8-metal", checkpoint: "Qwen/Qwen3.8-27B-FP8", backend: "metal", batchSize: 1 },
    { id: "qwen3-8-27b-cuda", checkpoint: "Qwen/Qwen3.8-27B", backend: "cuda", dspine: true },
    { id: "qwen3-8-27b-rocm", checkpoint: "Qwen/Qwen3.8-27B", backend: "rocm", dspine: true },
    { id: "qwen3-8-27b-oneapi", checkpoint: "Qwen/Qwen3.8-27B", backend: "oneapi" },
    { id: "qwen3-8-27b-tpu", checkpoint: "Qwen/Qwen3.8-27B", backend: "tpu" },
    { id: "qwen3-8-27b-nvfp4-metal", checkpoint: "nvidia/Qwen3.8-27B-NVFP4", backend: "metal", batchSize: 1 },
    { id: "qwen3-8-flash-next-cuda", checkpoint: "Qwen/Qwen3.8-Flash-Next", backend: "cuda" },
    { id: "qwen3-8-flash-next-rocm", checkpoint: "Qwen/Qwen3.8-Flash-Next", backend: "rocm" },
    { id: "deepseek-v4-1-flash-cuda", checkpoint: "deepseek-ai/DeepSeek-V4.1-Flash", backend: "cuda" },
    { id: "deepseek-v4-1-flash-rocm", checkpoint: "deepseek-ai/DeepSeek-V4.1-Flash", backend: "rocm" },
    { id: "mistral-large-4-cuda", checkpoint: "mistralai/Mistral-Large-4-1T-A52B", backend: "cuda", shm: "32GB" },
  ];
  const gemmaPreset = { id: "gemma-4-31b-it-cuda", checkpoint: "google/gemma-4-31B-it", backend: "cuda" };
  const launchFragments = ["before-you-start", "install-llmd", "start-the-server"];
  const overrides = [
    ["context", "max-context-len"],
    ["batch", "batch-size"],
    ["tokens", "token-batch-size"],
    ["memory", "gpu-memory-fraction"],
  ];
  const homePrefix = "${HOME}";
  const drafterCheckpoint = "tencent/Qwen3.8-27B-DSpine-b16";
  const drafterDirectory = homePrefix + "/models/" + drafterCheckpoint;
  const continuation = " \\" + "\n";

  function shellQuote(value) {
    if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
    return "'" + value.replaceAll("'", "'\\''") + "'";
  }

  function homePath(directory) {
    return '"${HOME:?Set HOME to your absolute home directory}"' + shellQuote(directory.slice(homePrefix.length));
  }

  function directoryError(directory) {
    const prefix = homePrefix + "/";
    if (!directory.startsWith(prefix)) {
      return "Start the path with ${HOME}/, for example ${HOME}/models/org/checkpoint.";
    }
    if (/[\r\n\u0000]|\p{White_Space}$/u.test(directory)) {
      return "Remove line breaks, null characters, or whitespace at the end of the path.";
    }
    const parts = directory.slice(prefix.length).split("/");
    if (parts.includes("..")) {
      return "Remove the .. path component and use a subdirectory of ${HOME}.";
    }
    if (!parts.some(part => part && part !== ".")) {
      return "Add a subdirectory after ${HOME}/, such as models/org/checkpoint.";
    }
    return "";
  }

  function cacheDirectoryError(directory) {
    if (!directory.startsWith("/")) {
      return "Enter an absolute path, such as /tmp/furiosa-tcc-cache.";
    }
    if (directory.includes(":")) {
      return "Remove colons. Docker uses : to separate the host path from the container path.";
    }
    if (/[\u0000-\u001f\u007f]|\p{White_Space}$/u.test(directory)) {
      return "Remove control characters or whitespace at the end of the path.";
    }
    const parts = directory.split("/");
    if (parts.includes("..") || !parts.some(part => part && part !== ".")) {
      return "Choose a subdirectory of / and remove any .. path component.";
    }
    return "";
  }

  function integerError(value, max, required = false) {
    if (!value && !required) return "";
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max) return "";
    return "Enter a whole number from 1 to " + max.toLocaleString("en-US") + " using digits only.";
  }

  function parseListenAddress(value) {
    if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) {
      return value.split(".").every(octet => Number(octet) <= 255) ? value : "";
    }
    const address = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
    if (!address.includes(":") || !/^[0-9a-f:.]+$/i.test(address)) return "";
    try {
      return new URL("http://[" + address + "]").hostname;
    } catch {
      return "";
    }
  }

  function memoryError(value) {
    if (!value) return "";
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
      return "Enter a number such as 0.5. Use a decimal point in place of a comma.";
    }
    const fraction = Number(value);
    if (fraction <= 0 || fraction > 1) {
      return "Enter a fraction greater than 0 and at most 1.";
    }
    if (Math.fround(fraction) === 0) {
      return "This fraction rounds to zero. Enter a larger value such as 0.5.";
    }
    return "";
  }

  function downloadCommand({ checkpoint, directory }) {
    return [
      "uvx --from huggingface_hub hf download " + shellQuote(checkpoint),
      "  --local-dir " + homePath(directory),
    ].join(continuation);
  }

  function servedModelName(checkpoint) {
    return checkpoint.split("/").at(-1);
  }

  function apiUrl(endpoint, route) {
    return shellQuote("http://" + endpoint + "/v1/" + route);
  }

  function llmdArguments(settings, modelArgument, defaultBatch) {
    const args = ["  --model=" + modelArgument, "  --model-name=" + shellQuote(servedModelName(settings.checkpoint))];
    if (settings.dspine) {
      const drafter = settings.drafterSource === "local" ? "/drafter" : "hf://" + drafterCheckpoint;
      args.push("  --speculative-drafter-model=" + shellQuote(drafter), "  --batch-size=1");
    }
    for (const [name, flag] of overrides) {
      const value = name === "batch" ? settings.batch || defaultBatch : settings[name];
      if (value) args.push("  --" + flag + "=" + Number(value));
    }
    return args;
  }

  function withAbsoluteHome(command, setup = []) {
    return [
      "(",
      '  case "${HOME:?Set HOME to your absolute home directory}" in',
      "    /*) ;;",
      "    *) printf '%s\\n' 'HOME must be an absolute path.' >&2; exit 1 ;;",
      "  esac",
      ...setup,
      command.replace(/^/gm, "  "),
      ")",
    ].join("\n");
  }

  function nativeLaunchCommand(settings, listener, defaultBatch) {
    const localCheckpoint = settings.source !== "hub";
    const model = localCheckpoint ? homePath(settings.directory) : shellQuote("hf://" + settings.checkpoint);
    const command = [
      "llmd --listen=" + shellQuote(listener),
      ...llmdArguments(settings, model, defaultBatch),
    ].join(continuation);
    return localCheckpoint ? withAbsoluteHome(command) : command;
  }

  function dockerLaunchCommand(settings, image, backendOptions, listener, defaultBatch) {
    const { backend, checkpoint, directory, source, cacheDirectory } = settings;
    const localCheckpoint = source !== "hub";
    const localDrafter = settings.drafterSource === "local";
    const mounts = [];
    if (localCheckpoint) mounts.push({ name: "model", directory });
    if (localDrafter) mounts.push({ name: "drafter", directory: drafterDirectory });

    const lines = [
      "docker run " + (settings.runMode === "foreground" ? "--rm" : "-d") + " --name llmd",
      backendOptions.hostNetwork ? "  --net=host" : "  -p 127.0.0.1:" + Number(settings.port) + ":" + Number(settings.listenPort),
      ...backendOptions.devices.map(flag => "  " + flag),
    ];
    if (backend === "cuda") lines.push("  --gpus=" + shellQuote(settings.gpu));
    const shm = settings.shm === "recipe" ? backendOptions.shm : settings.shm;
    if (shm && shm !== "default") lines.push("  --shm-size=" + shellQuote(shm));
    // Docker expects CSV, including quotes around the entire source field.
    for (const { name } of mounts) {
      lines.push('  --mount "type=bind,\\"source=${' + name + '_src}\\",target=/' + name + ',readonly"');
    }
    if (cacheDirectory) {
      lines.push("  -v " + shellQuote(cacheDirectory + ":/cache/furiosa"), "  -e FURIOSA_COMPILER_CACHE=/cache/furiosa");
    }
    if (settings.hfToken) lines.push("  -e HF_TOKEN");
    const model = localCheckpoint ? "/model" : "hf://" + checkpoint;
    lines.push("  " + image, "  --listen=" + shellQuote(listener), ...llmdArguments(settings, shellQuote(model), defaultBatch));
    const createCacheDirectory = cacheDirectory ? "mkdir -p -- " + shellQuote(cacheDirectory) + " &&\n" : "";
    const command = createCacheDirectory + lines.join(continuation);
    if (!mounts.length) return command;

    const setup = mounts.map(({ name, directory }) =>
      "  " + name + "_src=$(printf '%s' " + homePath(directory) + " | sed 's/\"/\"\"/g') || exit 1"
    );
    return withAbsoluteHome(command, setup);
  }

  function chatCommand(checkpoint, endpoint) {
    const payload = JSON.stringify({
      model: servedModelName(checkpoint),
      messages: [{ role: "user", content: "Reply with one short greeting." }],
    }, null, 2);
    return [
      "curl -fsS " + apiUrl(endpoint, "chat/completions"),
      "  -H 'Content-Type: application/json'",
      "  -d " + shellQuote(payload.replaceAll("\n", "\n  ")),
    ].join(continuation);
  }

  function updateCode(code, value) {
    const copy = code.parentElement?.parentElement?.querySelector(".code-copy");
    if (copy) copy.disabled = !value;
    const shell = code.closest(".command-shell");
    if (shell) shell.hidden = !value;
    if (code.textContent === value) return;
    code.textContent = value;
    code.dispatchEvent(new Event("codechange", { bubbles: true }));
  }

  for (const root of document.querySelectorAll("[data-llmd-launch]")) {
    const form = root.querySelector("form");
    const part = name => root.querySelector(`[data-${name}]`);
    const field = name => form.elements.namedItem(name);
    const commandButtons = [...root.querySelectorAll("[data-command-choice]")];
    const commandPanels = Object.fromEntries([...root.querySelectorAll("[data-command-panel]")]
      .map(panel => [panel.dataset.commandPanel, panel]));
    const codeBlocks = [...root.querySelectorAll("code[data-command]")];
    const checkpointField = field("checkpoint");
    const backendField = field("backend");
    const dspineField = field("dspine");
    const drafterSourceField = field("drafterSource");
    const hfTokenField = field("hfToken");
    const persistCacheField = field("persistCompilerCache");
    const cacheDirectoryField = field("cacheDirectory");
    const batchField = field("batch");
    let checkpoint = checkpointField.value;
    let useDefaultCheckpoint = true;
    let activeCommand = "launch";

    function show(name, visible) {
      const element = part(name);
      if (element) element.hidden = !visible;
    }

    function setText(name, value) {
      for (const element of root.querySelectorAll(`[data-${name}]`)) {
        if (element.textContent !== value) element.textContent = value;
      }
    }

    function updateCheckpointDirectory() {
      const nextCheckpoint = checkpointField.value;
      if (nextCheckpoint === checkpoint) return;

      field("directory").value = homePrefix + "/models/" + nextCheckpoint;
      checkpoint = nextCheckpoint;
    }

    function applyPreset(id) {
      const gemma = id === gemmaPreset.id || id === "gemma-cuda";
      const preset = gemma ? gemmaPreset : presets.find(item => item.id === id);
      if (!preset) return;

      backendField.value = preset.backend;
      checkpointField.value = preset.checkpoint;
      useDefaultCheckpoint = false;
      if (gemma) field("source").value = "download";
      dspineField.checked = false;
      drafterSourceField.value = "hub";
      updateCheckpointDirectory();
      activeCommand = "launch";
    }

    function applyFragment() {
      const fragment = window.location.hash.slice(1);
      applyPreset(fragment);
      if (launchFragments.includes(fragment)) activeCommand = "launch";
      if (fragment === "before-you-start") {
        const requirements = part("requirements")?.closest("details");
        if (requirements) requirements.open = true;
      }
    }

    function showCommands(commands, available) {
      const focus = document.activeElement;
      const focusedButton = commandButtons.find(button => button === focus);
      const focusedPanel = Object.values(commandPanels).find(panel => panel.contains(focus));
      const focusedShell = root.contains(focus) ? focus.closest(".command-shell") : null;
      const canShow = key => key === "launch" || Boolean(commands[key]);
      if (!canShow(activeCommand)) activeCommand = "launch";
      const hasChoices = available.download || available["drafter-download"];
      show("command-choices", hasChoices);
      let activeButton;
      for (const button of commandButtons) {
        const key = button.dataset.commandChoice;
        const active = key === activeCommand;
        button.hidden = !available[key];
        button.disabled = !canShow(key);
        button.setAttribute("aria-pressed", String(active));
        commandPanels[key].hidden = !active;
        if (active) activeButton = button;
      }
      for (const code of codeBlocks) updateCode(code, commands[code.dataset.command]);
      if ((focusedButton && (!hasChoices || focusedButton.hidden || focusedButton.disabled)) || focusedPanel?.hidden || focusedShell?.hidden) {
        const destination = hasChoices ? activeButton : commandPanels.launch;
        destination?.focus();
      }
    }

    function render() {
      const backend = backendField.value;
      const backendOptions = backends[backend];
      const native = backend === "metal";
      const furiosa = backend === "furiosa";
      const hostListener = native || backendOptions.hostNetwork === true;
      const checkpoint = checkpointField.value;
      const preset = presets.find(item => item.checkpoint === checkpoint && item.backend === backend);
      const defaultBatch = preset?.batchSize;
      const recipeShm = preset?.shm ?? backendOptions.shm;
      const supportsDspine = !!preset?.dspine;
      if (!supportsDspine) dspineField.checked = false;
      dspineField.disabled = !supportsDspine;
      part("dspine").hidden = !supportsDspine;
      part("drafter-source").disabled = !dspineField.checked;
      batchField.disabled = dspineField.checked;
      part("batch").hidden = batchField.disabled;

      const source = field("source").value;
      const drafterSource = dspineField.checked ? drafterSourceField.value : "";
      hfTokenField.disabled = native || (source !== "hub" && drafterSource !== "hub");
      field("runMode").disabled = native;
      field("gpu").disabled = native;
      field("shm").disabled = native;
      field("listenAddress").disabled = !hostListener;
      field("listenPort").disabled = hostListener;
      persistCacheField.disabled = !furiosa;
      cacheDirectoryField.disabled = !furiosa || !persistCacheField.checked;
      batchField.placeholder = defaultBatch ? String(defaultBatch) : native ? "LLMD default" : "Image default";
      const settings = Object.fromEntries(new FormData(form));
      const listenAddress = hostListener ? parseListenAddress(settings.listenAddress) : "0.0.0.0";
      const errors = {
        directory: source === "hub" ? "" : directoryError(settings.directory),
        cacheDirectory: cacheDirectoryField.disabled ? "" : cacheDirectoryError(settings.cacheDirectory),
        port: integerError(settings.port, 65535, true),
        listenAddress: listenAddress ? "" : "Enter an IPv4 or IPv6 address without a port, such as 127.0.0.1 or ::1.",
        listenPort: hostListener ? "" : integerError(settings.listenPort, 65535, true),
        context: integerError(settings.context, 0xffffffff),
        batch: integerError(settings.batch, 0xffffffff),
        tokens: integerError(settings.tokens, 0xffffffff),
        memory: memoryError(settings.memory),
      };
      for (const [name, error] of Object.entries(errors)) {
        const message = root.querySelector('[data-field-error="' + name + '"]');
        if (message.textContent === error) continue;
        if (error) field(name).setAttribute("aria-invalid", "true");
        else field(name).removeAttribute("aria-invalid");
        message.textContent = error;
      }
      const hasErrors = Object.values(errors).some(Boolean);
      const listenPortName = hostListener ? "port" : "listenPort";
      const listener = listenAddress && !errors[listenPortName]
        ? listenAddress + ":" + Number(settings[listenPortName]) : "";
      const loopback = listenAddress === "[::]" ? "[::1]" : "127.0.0.1";
      const clientAddress = listenAddress === "0.0.0.0" || listenAddress === "[::]" ? loopback : listenAddress;
      const endpoint = clientAddress && !errors.port ? clientAddress + ":" + Number(settings.port) : "";
      const available = { download: source === "download", "drafter-download": drafterSource === "local", launch: true };
      const image = native ? "" : "zmlai/llmd:" + backend;
      let launch = "";
      if (!hasErrors) {
        launch = native ? nativeLaunchCommand(settings, listener, defaultBatch)
          : dockerLaunchCommand(settings, image, { ...backendOptions, shm: recipeShm }, listener, defaultBatch);
      }
      const commands = {
        download: available.download && !errors.directory ? downloadCommand(settings) : "",
        "drafter-download": available["drafter-download"]
          ? downloadCommand({ checkpoint: drafterCheckpoint, directory: drafterDirectory }) : "",
        setup: native ? "brew install zml/zml/llmd" : "docker pull " + image,
        launch,
        models: endpoint ? "curl -fsS " + apiUrl(endpoint, "models") : "",
        chat: endpoint ? chatCommand(checkpoint, endpoint) : "",
      };

      show("local", source !== "hub");
      show("drafter-path", drafterSource === "local");
      show("hub", !hfTokenField.disabled);
      show("cuda", backend === "cuda");
      show("furiosa-cache", furiosa);
      show("cache-directory", !cacheDirectoryField.disabled);
      show("furiosa-requirements", furiosa);
      show("tpu-requirements", backend === "tpu");
      show("host-listener", hostListener);
      show("container-listener", !hostListener);
      for (const element of root.querySelectorAll("[data-docker]")) element.hidden = native;
      show("error", hasErrors);
      show("request-error", !endpoint);
      setText("setup-title", native ? "Install LLMD" : "Pull the LLMD image");
      setText("setup-hint", native ? "Run once to install LLMD with Homebrew." : "Run to download or refresh the image for this backend.");
      setText("shm-hint", (recipeShm ? "Recipe setting passes --shm-size=" + recipeShm + "." : "Recipe setting uses the Docker default.")
        + " You can choose the Docker default or 1, 8, 32, or 256 GiB.");
      setText("launch-hint", hasErrors ? "Server command unavailable until the launch settings are valid." : "Run each time you start the server.");
      setText("hint", source === "hub"
        ? "LLMD reads the checkpoint from Hugging Face at startup."
        : native ? "Use the checkpoint directory directly on this Mac."
          : "Mount the checkpoint directory read-only from the Docker host.");
      setText("requirements", backendOptions.requirements);
      setText("selected-checkpoint", checkpoint);
      setText("fit", preset ? preset.evidence ?? "Published recipe for this checkpoint and accelerator."
        : "Confirm compatibility for this checkpoint and run target.");
      setText("endpoint", listener || "Enter a valid listener");
      setText("client-endpoint", endpoint || "Enter a valid host port");
      for (const element of root.querySelectorAll("[data-connect]")) element.hidden = hostListener && listener === endpoint;
      setText("expected-model-id", servedModelName(checkpoint));
      showCommands(commands, available);
    }

    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("input", event => {
      if (event.target === checkpointField) useDefaultCheckpoint = false;
      if (event.target === backendField && useDefaultCheckpoint) {
        checkpointField.value = presets.find(item => item.backend === backendField.value).checkpoint;
      }
      updateCheckpointDirectory();
      render();
    });

    window.addEventListener("hashchange", () => {
      applyFragment();
      render();
    });

    for (const button of commandButtons) {
      button.addEventListener("click", () => {
        activeCommand = button.dataset.commandChoice;
        render();
      });
    }
    updateCheckpointDirectory();
    applyPreset(new URLSearchParams(window.location.search).get("recipe"));
    applyFragment();
    setText("drafter-directory", drafterDirectory);
    render();
    form.hidden = false;
  }
})();
