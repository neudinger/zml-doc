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
  const gemmaPreset = { id: "gemma-4-31b-it-cuda", checkpoint: "google/gemma-4-31B-it", backend: "cuda", evidence: "Local checkpoint example for NVIDIA CUDA." };
  const launchFragments = ["before-you-start", "install-llmd", "start-the-server", "check-the-loaded-model", "first-request", "send-a-chat-request", "send-a-decision-request", "send-an-embeddings-request"];
  const overrides = [
    ["context", "max-context-len"],
    ["batch", "batch-size"],
    ["tokens", "token-batch-size"],
    ["memory", "gpu-memory-fraction"],
  ];
  const homePrefix = "${HOME}";
  const dspine = { mode: "dspine", label: "DSpine (published recipe)", drafter: "tencent/Qwen3.8-27B-DSpine-b16" };
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

  function llmdArguments(settings, modelArgument, run) {
    const args = ["  --model=" + modelArgument];
    // A local directory may use a different basename, especially the /model bind mount.
    const modelName = servedModelName(settings.checkpoint);
    if (!run.benchmark && settings.source !== "hub" &&
        (settings.backend !== "metal" || servedModelName(settings.directory.replace(/\/+$/, "")) !== modelName)) {
      args.push("  --model-name=" + shellQuote(modelName));
    }
    if (settings.decoding === "native") args.push("  --speculative-drafter-model=native");
    if (settings.drafter) {
      const local = settings.backend === "metal" ? homePath(settings.drafterDirectory) : "/drafter";
      const path = settings.drafterSource === "local" ? local : shellQuote("hf://" + settings.drafter);
      args.push("  --speculative-drafter-model=" + path);
    }
    if (run.benchmark) {
      args.push("  --bench");
      return args;
    }
    for (const [name, flag] of overrides) {
      const value = name === "batch" ? settings.batch || run.defaultBatch : settings[name];
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

  function nativeLaunchCommand(settings, run) {
    const localCheckpoint = settings.source !== "hub";
    const model = localCheckpoint ? homePath(settings.directory) : shellQuote("hf://" + settings.checkpoint);
    const command = [
      run.listener === "0.0.0.0:8000" ? "llmd" : "llmd --listen=" + shellQuote(run.listener),
      ...llmdArguments(settings, model, run),
    ].join(continuation);
    return localCheckpoint || settings.drafterSource === "local" ? withAbsoluteHome(command) : command;
  }

  function dockerLaunchCommand(settings, image, backendOptions, run) {
    const { backend, checkpoint, directory, source, cacheDirectory } = settings;
    const localCheckpoint = source !== "hub";
    const localDrafter = settings.drafterSource === "local";
    const mounts = [];
    if (localCheckpoint) mounts.push({ name: "model", directory });
    if (localDrafter) mounts.push({ name: "drafter", directory: settings.drafterDirectory });

    const lines = [run.benchmark ? "docker run --rm"
      : "docker run " + (settings.runMode === "foreground" ? "--rm" : "-d") + " --name llmd"];
    if (backendOptions.hostNetwork) lines.push("  --net=host");
    else if (!run.benchmark) lines.push("  -p 127.0.0.1:" + Number(settings.port) + ":" + Number(settings.listenPort));
    lines.push(...backendOptions.devices.map(flag => "  " + flag));
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
    lines.push("  " + image);
    if (run.listener !== "0.0.0.0:8000") lines.push("  --listen=" + shellQuote(run.listener));
    lines.push(...llmdArguments(settings, shellQuote(model), run));
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
    const decodingField = field("decoding");
    const requestField = field("request");
    const drafterSourceField = field("drafterSource");
    const hfTokenField = field("hfToken");
    const persistCacheField = field("persistCompilerCache");
    const cacheDirectoryField = field("cacheDirectory");
    const batchField = field("batch");
    const standard = { mode: "standard", label: "Standard", drafter: "" };
    const routineModes = new Map();
    for (const row of document.querySelectorAll("[data-llmd-routines] [data-checkpoint]")) {
      const modes = [...row.querySelectorAll("[data-decoding]")].map(item => ({
        mode: item.dataset.decoding, label: item.textContent.trim(), drafter: item.dataset.drafter,
      }));
      routineModes.set(row.dataset.checkpoint, modes);
    }
    let checkpoint = checkpointField.value;
    const requestTypes = [
      { key: "decision", label: "Decision", route: "systemone" },
      { key: "embeddings", label: "Embeddings", route: "embeddings" },
    ];
    const listed = new Set([...routineModes.keys(), ...Array.from(checkpointField.options, option => option.value)]);
    for (const type of requestTypes) {
      type.example = root.querySelector(`code[data-command="${type.key}"]`).textContent;
      type.checkpoints = new Set(Array.from(document.querySelectorAll(`[data-llmd-${type.key}] [data-checkpoint]`),
        row => row.dataset.checkpoint));
      const group = part(type.key + "-options");
      for (const name of type.checkpoints) {
        if (listed.has(name)) continue;
        group.append(new Option(name, name));
        listed.add(name);
      }
    }
    if (routineModes.size) {
      part("routine-options").replaceChildren(...[...routineModes.keys()].map(name => new Option(name, name)));
      checkpointField.value = checkpoint;
    }
    let legacyPreset = null;
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

    function refreshDecoding(mode = decodingField.value) {
      const checkpoint = checkpointField.value;
      const options = [...(routineModes.get(checkpoint) ?? [standard])];
      if (presets.some(item => item.checkpoint === checkpoint && item.backend === backendField.value && item.dspine)) {
        options.push(dspine);
      }
      decodingField.replaceChildren(...options.map(option => new Option(option.label, option.mode)));
      decodingField.value = options.some(option => option.mode === mode) ? mode : "standard";
    }

    function refreshRequest(preferred) {
      const name = checkpointField.value;
      const options = requestTypes.filter(type => type.checkpoints.has(name)).map(type => new Option(type.label, type.key));
      const hasSpecialRequest = options.length > 0;
      if (!hasSpecialRequest || routineModes.has(name)) options.unshift(new Option("Chat", "chat"));
      requestField.replaceChildren(...options);
      requestField.value = options.find(option => option.value === preferred)?.value ?? options[0].value;
      show("request-type", hasSpecialRequest);
    }

    function selectLaunch(preset, mode, request = "chat") {
      backendField.value = preset.backend;
      checkpointField.value = preset.checkpoint;
      refreshDecoding(mode);
      refreshRequest(request);
      drafterSourceField.value = "hub";
      updateCheckpointDirectory();
      activeCommand = "launch";
    }

    function applyPreset(id) {
      const gemma = id === gemmaPreset.id || id === "gemma-cuda";
      const useDspine = typeof id === "string" && id.endsWith("-dspine");
      const presetId = useDspine ? id.slice(0, -"-dspine".length) : id;
      const preset = gemma ? gemmaPreset : presets.find(item => item.id === presetId);
      if (!preset || (useDspine && !preset.dspine)) return;
      legacyPreset = preset;
      if (gemma) field("source").value = "download";
      selectLaunch(preset, useDspine ? "dspine" : "standard");
    }

    function applyQuery() {
      const query = new URLSearchParams(window.location.search);
      const checkpoint = query.get("checkpoint");
      const backend = query.get("backend");
      const decoding = query.get("decoding");
      const knownMode = routineModes.get(checkpoint)?.some(option => option.mode === decoding)
        || (decoding === "standard" && requestTypes.some(type => type.checkpoints.has(checkpoint)));
      if (Object.hasOwn(backends, backend) && knownMode) {
        legacyPreset = null;
        selectLaunch({ checkpoint, backend }, decoding, query.get("request"));
      } else {
        applyPreset(query.get("recipe"));
      }
    }

    function applyFragment() {
      const fragment = window.location.hash.slice(1);
      applyPreset(fragment);
      if (fragment === "llmd-benchmark") activeCommand = "benchmark";
      if (launchFragments.includes(fragment)) activeCommand = "launch";
      if (fragment === "send-a-chat-request") refreshRequest("chat");
      if (fragment === "send-a-decision-request") refreshRequest("decision");
      if (fragment === "send-an-embeddings-request") {
        const embeddings = requestTypes.find(type => type.key === "embeddings");
        if (!embeddings.checkpoints.has(checkpointField.value) && embeddings.checkpoints.size) {
          legacyPreset = null;
          selectLaunch({ checkpoint: embeddings.checkpoints.values().next().value, backend: backendField.value }, "standard", "embeddings");
        } else {
          refreshRequest("embeddings");
        }
      }
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
      const canShow = key => available[key] && (key === "launch" || key === "benchmark" || Boolean(commands[key]));
      if (!canShow(activeCommand)) activeCommand = "launch";
      show("command-choices", true);
      show("server-context", activeCommand !== "benchmark");
      show("server-requests", activeCommand !== "benchmark");
      show("error", !commands.launch && activeCommand !== "benchmark");
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
      if ((focusedButton && (focusedButton.hidden || focusedButton.disabled)) || focusedPanel?.hidden || focusedShell?.hidden) {
        activeButton?.focus();
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
      const decoding = decodingField.value;
      const requestType = requestField.value;
      const embeddings = requestType === "embeddings";
      const routine = routineModes.get(checkpoint);
      const profile = decoding === "dspine" ? dspine : routine?.find(option => option.mode === decoding);
      const drafter = profile?.drafter || "";
      const drafterDirectory = drafter ? homePrefix + "/models/" + drafter : "";
      const defaultBatch = decoding === "dspine" ? 1 : legacyPreset?.batchSize;
      const recipeShm = preset?.shm ?? backendOptions.shm;
      part("drafter-source").disabled = !drafter;
      show("drafter-source", Boolean(drafter));
      batchField.disabled = decoding === "dspine";
      part("batch").hidden = batchField.disabled;

      const source = field("source").value;
      const drafterSource = drafter ? drafterSourceField.value : "";
      hfTokenField.disabled = native || (source !== "hub" && drafterSource !== "hub");
      field("runMode").disabled = native;
      field("gpu").disabled = native;
      field("shm").disabled = native;
      field("listenAddress").disabled = !hostListener;
      field("listenPort").disabled = hostListener;
      persistCacheField.disabled = !furiosa;
      cacheDirectoryField.disabled = !furiosa || !persistCacheField.checked;
      batchField.placeholder = defaultBatch ? String(defaultBatch) : "LLMD default";
      const settings = Object.fromEntries(new FormData(form));
      settings.drafter = drafter;
      settings.drafterDirectory = drafterDirectory;
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
      const available = { download: source === "download", "drafter-download": drafterSource === "local", launch: true, benchmark: !embeddings };
      const image = native ? "" : "zmlai/llmd:" + backend;
      function runCommand(configuration, run) {
        return native ? nativeLaunchCommand(configuration, run)
          : dockerLaunchCommand(configuration, image, { ...backendOptions, shm: recipeShm }, run);
      }
      // The benchmark client connects to the actual bound port inside its own process.
      const benchmarkRun = { listener: "127.0.0.1:0", benchmark: true };
      const benchmarkReady = available.benchmark && !errors.directory && !errors.cacheDirectory;
      const standardSettings = { ...settings, decoding: "standard", drafter: "", drafterSource: "",
        hfToken: source === "hub" && settings.hfToken };
      const commands = {
        download: available.download && !errors.directory ? downloadCommand(settings) : "",
        "drafter-download": available["drafter-download"]
          ? downloadCommand({ checkpoint: drafter, directory: drafterDirectory }) : "",
        setup: native ? "brew install zml/zml/llmd" : "docker pull " + image,
        launch: hasErrors ? "" : runCommand(settings, { listener, defaultBatch }),
        "benchmark-standard": benchmarkReady ? runCommand(standardSettings, benchmarkRun) : "",
        "benchmark-speculative": benchmarkReady && decoding !== "standard" ? runCommand(settings, benchmarkRun) : "",
        models: endpoint ? "curl -fsS " + apiUrl(endpoint, "models") : "",
        chat: requestType === "chat" && endpoint ? chatCommand(checkpoint, endpoint) : "",
      };
      for (const type of requestTypes) {
        const selected = requestType === type.key;
        commands[type.key] = selected && endpoint
          ? type.example.replace("http://127.0.0.1:8000/v1/" + type.route, apiUrl(endpoint, type.route)) : "";
        show(type.key + "-request", selected);
      }

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
      show("decoding-field", !embeddings);
      show("benchmark-standard", benchmarkReady);
      show("benchmark-error", !benchmarkReady);
      show("benchmark-speculative", benchmarkReady && decoding !== "standard");
      setText("benchmark-mode", decoding === "dspine" ? "DSpine" : decodingField.selectedOptions[0].textContent);
      show("request-error", !endpoint);
      show("chat-request", requestType === "chat");
      const hints = {
        standard: "Use the model without a speculative drafter.",
        native: "Use this checkpoint’s built-in multi-token prediction drafter. No separate download is required.",
        external: "Use the paired drafter " + drafter + ".",
        dspine: "Use " + drafter + " with LLMD 20261112.0 or later. Launch uses the published batch size of 1. Benchmark uses LLMD defaults.",
      };
      setText("decoding-hint", hints[decoding]);
      setText("drafter-directory", drafterDirectory);
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
      const published = legacyPreset || (decoding === "dspine" ? preset : null);
      setText("fit", published ? published.evidence ?? "Published launch recipe for this checkpoint and accelerator."
        : routine ? "Routine test target. Check the model catalog for recorded backend results."
        : requestType !== "chat" ? requestField.selectedOptions[0].textContent + " checkpoint. Verify that your LLMD build supports this checkpoint on the selected backend."
        : preset ? preset.evidence ?? "A published recipe is available for this checkpoint and accelerator."
        : "Confirm compatibility for this checkpoint and run target.");
      setText("endpoint", listener || "Enter a valid listener");
      setText("client-endpoint", endpoint || "Enter a valid host port");
      for (const element of root.querySelectorAll("[data-connect]")) element.hidden = hostListener && listener === endpoint;
      setText("expected-model-id", servedModelName(checkpoint));
      showCommands(commands, available);
    }

    form.addEventListener("submit", event => event.preventDefault());
    requestField.addEventListener("change", render);
    form.addEventListener("input", event => {
      if ([checkpointField, backendField, decodingField].includes(event.target)) legacyPreset = null;
      if (event.target === checkpointField || event.target === backendField) {
        refreshDecoding(event.target === checkpointField ? "standard" : decodingField.value);
      }
      if (event.target === checkpointField) refreshRequest(requestField.value);
      updateCheckpointDirectory();
      render();
    });

    function renderFragment() {
      const target = document.getElementById(window.location.hash.slice(1));
      const needsScroll = target?.closest("[hidden]");
      applyFragment();
      render();
      if (needsScroll && !target.closest("[hidden]")) target.scrollIntoView();
    }
    window.addEventListener("hashchange", () => {
      if (!window.location.hash) applyQuery();
      renderFragment();
    });

    for (const button of commandButtons) {
      button.addEventListener("click", () => {
        activeCommand = button.dataset.commandChoice;
        render();
      });
    }
    updateCheckpointDirectory();
    refreshDecoding();
    refreshRequest("chat");
    applyQuery();
    renderFragment();
    form.hidden = false;
  }
})();
