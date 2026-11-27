import { compareCheckpoints, compareNames, modelFamily, modelName as servedModelName } from "./llmd-model-families.js";

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
    { id: "lfm3-fp8-metal", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "metal" },
    { id: "lfm3-fp8-cuda", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "cuda" },
    { id: "lfm3-fp8-rocm", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "rocm" },
    { id: "lfm3-bf16-metal", checkpoint: "LiquidAI/LFM3-1.7B", backend: "metal", evidence: "Benchmarked upstream with this BF16 checkpoint on M3 Max." },
    { id: "lfm3-bf16-cuda", checkpoint: "LiquidAI/LFM3-1.7B", backend: "cuda", evidence: lfm3Bf16DockerEvidence },
    { id: "lfm3-bf16-rocm", checkpoint: "LiquidAI/LFM3-1.7B", backend: "rocm", evidence: lfm3Bf16DockerEvidence },
    { id: "lfm3-oneapi", checkpoint: "LiquidAI/LFM3-1.7B", backend: "oneapi" },
    { id: "lfm3-tpu", checkpoint: "LiquidAI/LFM3-1.7B", backend: "tpu" },
    { id: "lfm3-furiosa", checkpoint: "LiquidAI/LFM3-1.7B", backend: "furiosa", evidence: "Tested upstream on Furiosa. Docker recipe pending hardware validation." },
    { id: "qwen3-8-27b-fp8-metal", checkpoint: "Qwen/Qwen3.8-27B-FP8", backend: "metal" },
    { id: "qwen3-8-27b-cuda", checkpoint: "Qwen/Qwen3.8-27B", backend: "cuda", drafter: "tencent/Qwen3.8-27B-DSpine-b16" },
    { id: "qwen3-8-27b-rocm", checkpoint: "Qwen/Qwen3.8-27B", backend: "rocm", drafter: "tencent/Qwen3.8-27B-DSpine-b16" },
    { id: "qwen3-8-27b-oneapi", checkpoint: "Qwen/Qwen3.8-27B", backend: "oneapi" },
    { id: "qwen3-8-27b-tpu", checkpoint: "Qwen/Qwen3.8-27B", backend: "tpu" },
    { id: "qwen3-8-27b-nvfp4-metal", checkpoint: "nvidia/Qwen3.8-27B-NVFP4", backend: "metal" },
    { id: "qwen3-8-flash-next-cuda", checkpoint: "Qwen/Qwen3.8-Flash-Next", backend: "cuda" },
    { id: "qwen3-8-flash-next-rocm", checkpoint: "Qwen/Qwen3.8-Flash-Next", backend: "rocm" },
    { id: "deepseek-v4-1-flash-cuda", checkpoint: "deepseek-ai/DeepSeek-V4.1-Flash", backend: "cuda" },
    { id: "deepseek-v4-1-flash-rocm", checkpoint: "deepseek-ai/DeepSeek-V4.1-Flash", backend: "rocm" },
    { id: "mistral-large-4-cuda", checkpoint: "mistralai/Mistral-Large-4-1T-A52B", backend: "cuda", shm: "32GB" },
  ];
  const gemmaPreset = { id: "gemma-4-31b-it-cuda", checkpoint: "google/gemma-4-31B-it", backend: "cuda", evidence: "Local model example for NVIDIA CUDA." };
  const homePrefix = "${HOME}";
  const continuation = " \\" + "\n";

  function shellQuote(value) {
    if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) return value;
    return "'" + value.replaceAll("'", "'\\''") + "'";
  }

  function homePath(directory) {
    const suffix = directory.slice(homePrefix.length).replace(/["\\$`]/g, "\\$&");
    return '"' + homePrefix + suffix + '"';
  }

  function directoryError(directory) {
    const prefix = homePrefix + "/";
    if (!directory.startsWith(prefix)) {
      return "Start the path with ${HOME}/, for example ${HOME}/models/org/model.";
    }
    if (/[\r\n\u0000]|\p{White_Space}$/u.test(directory)) {
      return "Remove line breaks, null characters, or whitespace at the end of the path.";
    }
    const parts = directory.slice(prefix.length).split("/");
    if (parts.includes("..")) {
      return "Remove the .. path component and use a subdirectory of ${HOME}.";
    }
    if (!parts.some(part => part && part !== ".")) {
      return "Add a subdirectory after ${HOME}/, such as models/org/model.";
    }
    return "";
  }

  function normalizeDirectory(directory) {
    return directory.split("/").filter(part => part && part !== ".").join("/");
  }

  function downloadCommand({ checkpoint, directory }) {
    return [
      "uvx --from huggingface_hub hf download " + shellQuote(checkpoint),
      "  --local-dir " + homePath(directory),
    ].join(continuation);
  }

  function apiUrl(endpoint, route) {
    return shellQuote("http://" + endpoint + "/v1/" + route);
  }

  function modelArguments(model, drafter) {
    const args = ["  --model=" + model];
    if (drafter) args.push("  --speculative-drafter-model=" + drafter);
    return args;
  }

  function nativeLaunchCommand(settings) {
    const { checkpoint, directory, drafter, drafterDirectory, port } = settings;
    const model = directory ? homePath(directory) : shellQuote("hf://" + checkpoint);
    const draft = drafterDirectory ? homePath(drafterDirectory) : drafterArgument(drafter);
    return ["llmd --listen=127.0.0.1:" + port, ...modelArguments(model, draft)].join(continuation);
  }

  function drafterArgument(drafter) {
    return drafter && (drafter === "native" ? drafter : shellQuote("hf://" + drafter));
  }

  function dockerLaunchCommand(settings, image, backendOptions, shm) {
    const { backend, checkpoint, directory, drafter, drafterDirectory, port } = settings;
    const model = directory ? "/models/" + servedModelName(checkpoint) : "hf://" + checkpoint;
    const mounts = [];
    if (directory) mounts.push({ name: "model", directory, target: model });
    if (drafterDirectory) mounts.push({ name: "drafter", directory: drafterDirectory, target: "/drafter" });

    const lines = ["docker run --rm --name llmd"];
    if (backendOptions.hostNetwork) lines.push("  --net=host");
    else lines.push("  -p 127.0.0.1:" + port + ":8000");
    lines.push(...backendOptions.devices.map(flag => "  " + flag));
    if (backend === "cuda") lines.push("  --gpus=all");
    if (shm) lines.push("  --shm-size=" + shm);
    // Docker expects CSV, including quotes around the entire source field.
    for (const { name, target } of mounts) {
      lines.push('  --mount "type=bind,\\"source=${' + name + '_src}\\",target=' + target + ',readonly"');
    }
    const listener = backendOptions.hostNetwork ? "127.0.0.1:" + port : "0.0.0.0:8000";
    const draft = drafterDirectory ? "/drafter" : drafterArgument(drafter);
    lines.push("  " + image, "  --listen=" + listener, ...modelArguments(shellQuote(model), draft));
    const command = lines.join(continuation);
    if (!mounts.length) return command;

    const setup = mounts.map(({ name, directory }) =>
      "  " + name + "_src=$(printf '%s' " + homePath(directory) + " | sed 's/\"/\"\"/g') || exit 1"
    );
    return ["(", ...setup, command.replace(/^/gm, "  "), ")"].join("\n");
  }

  function chatCommand(model, endpoint) {
    const payload = JSON.stringify({
      model,
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
    const codeBlocks = [...root.querySelectorAll("code[data-command]")];
    const modelList = JSON.parse(root.querySelector('code[data-command="models-response"]').textContent);
    const checkpointField = field("checkpoint");
    const backendField = field("backend");
    const drafterField = field("drafter");
    const sourceField = field("source");
    const directoryField = field("directory");
    const drafterDirectoryField = field("drafterDirectory");
    const portField = field("port");
    const requestField = field("request");
    const families = new Map();
    function addModel({ family, checkpoint }) {
      const parent = modelFamily(family);
      if (!families.has(parent)) families.set(parent, new Set());
      families.get(parent).add(checkpoint);
    }
    const requestTypes = [
      { key: "decision", label: "Decision", route: "systemone" },
      { key: "embeddings", label: "Embeddings", route: "embeddings" },
    ];
    for (const type of requestTypes) {
      type.example = root.querySelector(`code[data-command="${type.key}"]`).textContent;
      type.checkpoints = new Set();
    }
    const routineModes = new Map();
    for (const row of document.querySelectorAll("[data-llmd-models] [data-checkpoint]")) {
      addModel(row.dataset);
      const modes = [...row.querySelectorAll("[data-decoding]")].map(item => ({
        mode: item.dataset.decoding, drafter: item.dataset.drafter,
      }));
      if (modes.length) routineModes.set(row.dataset.checkpoint, modes);
      for (const type of requestTypes) {
        if (row.querySelector(`[data-capability="${type.key}"]`)) type.checkpoints.add(row.dataset.checkpoint);
      }
    }
    const pairings = new Map();
    for (const row of document.querySelectorAll("[data-llmd-pairings] tr[data-checkpoint]")) {
      addModel(row.dataset);
      pairings.set(row.dataset.checkpoint, Array.from(row.querySelectorAll("li[data-drafter]"), item => item.dataset.drafter));
    }
    let checkpoint = checkpointField.value;
    checkpointField.replaceChildren(...[...families.keys()].sort(compareNames).map(family => {
      const group = document.createElement("optgroup");
      group.label = family;
      for (const id of [...families.get(family)].sort(compareCheckpoints)) group.append(new Option(id, id, id === checkpoint));
      return group;
    }));
    checkpointField.value = checkpoint;
    let previousDrafter = "";
    let legacyPreset = null;
    let invalidLink = false;

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
      if (checkpointField.value === checkpoint) return;
      checkpoint = checkpointField.value;
      directoryField.value = homePrefix + "/models/" + checkpoint;
    }

    function refreshDrafters(preferred) {
      const checkpoint = checkpointField.value;
      const modes = routineModes.get(checkpoint) ?? [];
      const native = modes.some(option => option.mode === "native");
      const recommended = modes.find(option => option.mode === "external")?.drafter;
      const external = new Set(pairings.get(checkpoint));
      if (recommended) external.add(recommended);
      const options = [new Option("No drafter", "")];
      if (native) options.push(new Option("Built-in drafter (included with model)", "native"));
      for (const id of external) options.push(new Option(id, id));
      // An external link can request the recommended drafter without naming it.
      const selected = preferred === null
        ? recommended ?? external.values().next().value
        : preferred ?? (native ? "native" : "");
      drafterField.replaceChildren(...options);
      drafterField.disabled = options.length === 1;
      drafterField.value = options.some(option => option.value === selected) ? selected : "";
    }

    function refreshRequest(preferred) {
      const name = checkpointField.value;
      const options = requestTypes.filter(type => type.checkpoints.has(name)).map(type => new Option(type.label, type.key));
      const hasSpecialRequest = options.length > 0;
      if (!hasSpecialRequest || routineModes.has(name)) options.unshift(new Option("Chat", "chat"));
      requestField.replaceChildren(...options);
      requestField.value = options.find(option => option.value === preferred)?.value ?? options[0].value;
      show("request-type", options.length > 1);
    }

    function selectLaunch(preset, drafter, request = "chat") {
      invalidLink = false;
      backendField.value = preset.backend;
      checkpointField.value = preset.checkpoint;
      refreshDrafters(drafter);
      refreshRequest(request);
      updateCheckpointDirectory();
    }

    function applyPreset(id) {
      const gemma = id === gemmaPreset.id || id === "gemma-cuda";
      const useDspine = typeof id === "string" && id.endsWith("-dspine");
      const presetId = useDspine ? id.slice(0, -"-dspine".length) : id;
      const preset = gemma ? gemmaPreset : presets.find(item => item.id === presetId);
      if (!preset || (useDspine && !preset.drafter)) return false;
      legacyPreset = preset;
      if (gemma) sourceField.value = "download";
      selectLaunch(preset, useDspine ? preset.drafter : undefined);
      return true;
    }

    function applyQuery() {
      const query = new URLSearchParams(window.location.search);
      const checkpoint = query.get("model") ?? query.get("checkpoint");
      const backend = query.get("backend");
      const decoding = query.get("decoding");
      const drafter = query.get("drafter");
      const knownMode = routineModes.get(checkpoint)?.some(option => option.mode === decoding)
        || (pairings.has(checkpoint) && (decoding === "external" || decoding === "standard"))
        || (decoding === "standard" && requestTypes.some(type => type.checkpoints.has(checkpoint)));
      if (Object.hasOwn(backends, backend) && knownMode) {
        legacyPreset = null;
        const preferred = decoding === "external" ? drafter : decoding === "native" ? "native" : "";
        selectLaunch({ checkpoint, backend }, preferred, query.get("request"));
        invalidLink = drafter !== null && (decoding !== "external" || drafterField.value !== drafter);
      } else if (drafter !== null) {
        invalidLink = true;
      } else {
        applyPreset(query.get("recipe"));
      }
    }

    function applyFragment(fragment) {
      if (fragment === "download-checkpoint") sourceField.value = "download";
      if (fragment === "download-drafter") {
        const externalDrafter = [...drafterField.options].find(option => option.value && option.value !== "native");
        if (externalDrafter) {
          if (!drafterField.value || drafterField.value === "native") drafterField.value = externalDrafter.value;
          sourceField.value = "download";
        }
      }
      if (fragment === "send-a-chat-request") refreshRequest("chat");
      if (fragment === "send-a-decision-request") refreshRequest("decision");
      if (fragment === "send-an-embeddings-request") {
        const embeddings = requestTypes.find(type => type.key === "embeddings");
        if (!embeddings.checkpoints.has(checkpointField.value) && embeddings.checkpoints.size) {
          legacyPreset = null;
          selectLaunch({ checkpoint: embeddings.checkpoints.values().next().value, backend: backendField.value }, "", "embeddings");
        } else {
          refreshRequest("embeddings");
        }
      }
      if (fragment === "before-you-start" && backendField.value === "furiosa") part("furiosa-requirements").open = true;
    }

    function render() {
      const backend = backendField.value;
      const backendOptions = backends[backend];
      const native = backend === "metal";
      const checkpoint = checkpointField.value;
      const preset = presets.find(item => item.checkpoint === checkpoint && item.backend === backend);
      const source = sourceField.value;
      const requestType = requestField.value;
      const drafter = drafterField.value;
      const external = Boolean(drafter) && drafter !== "native";
      if (drafter !== previousDrafter) {
        drafterDirectoryField.value = external ? homePrefix + "/models/" + drafter : "";
        previousDrafter = drafter;
      }
      const local = source !== "hub";
      const localDrafter = local && external;
      const directory = local ? normalizeDirectory(directoryField.value) : "";
      const drafterDirectory = localDrafter ? normalizeDirectory(drafterDirectoryField.value) : "";
      const download = source === "download";
      const port = Number(portField.value);
      const validPort = /^\d+$/.test(portField.value) && port >= 1 && port <= 65535;
      const endpoint = validPort ? "127.0.0.1:" + port : "";
      const errors = {
        directory: local ? directoryError(directoryField.value) : "",
        drafterDirectory: localDrafter ? directoryError(drafterDirectoryField.value) : "",
        port: validPort ? "" : "Enter a whole number from 1 to 65535.",
      };
      if (download && localDrafter && !errors.directory && !errors.drafterDirectory && directory === drafterDirectory) {
        errors.drafterDirectory = "Use a different directory for the drafter weights.";
      }
      for (const [name, error] of Object.entries(errors)) {
        const input = field(name);
        if (error) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
        const message = root.querySelector(`[data-field-error="${name}"]`);
        if (message.textContent !== error) message.textContent = error;
      }
      const settings = { backend, checkpoint, directory, drafter, drafterDirectory, port };
      const modelId = native && directory ? servedModelName(directory) : servedModelName(checkpoint);
      const image = "zmlai/llmd:" + backend;
      const hasErrors = invalidLink || Object.values(errors).some(Boolean);
      const commands = {
        download: download && !errors.directory ? downloadCommand(settings) : "",
        "drafter-download": download && external && !errors.drafterDirectory
          ? downloadCommand({ checkpoint: drafter, directory: drafterDirectory }) : "",
        setup: native ? "brew install zml/zml/llmd" : "docker pull " + image,
        launch: hasErrors ? "" : native ? nativeLaunchCommand(settings)
          : dockerLaunchCommand(settings, image, backendOptions, preset?.shm ?? backendOptions.shm),
        models: endpoint ? "curl -fsS " + apiUrl(endpoint, "models") : "",
        chat: requestType === "chat" && endpoint && !errors.directory ? chatCommand(modelId, endpoint) : "",
      };
      modelList.data[0].id = modelId;
      commands["models-response"] = commands.models && !errors.directory ? JSON.stringify(modelList, null, 2) : "";

      for (const type of requestTypes) {
        const selected = requestType === type.key;
        commands[type.key] = selected && endpoint
          ? type.example.replace("http://127.0.0.1:8000/v1/" + type.route, apiUrl(endpoint, type.route)) : "";
        show(type.key + "-request", selected);
      }

      show("link-error", invalidLink);
      show("error", hasErrors);
      show("download-weights", Boolean(commands.download || commands["drafter-download"]));
      show("local", local);
      show("local-drafter", localDrafter);
      show("gated-access", source !== "local");
      show("furiosa-requirements", backend === "furiosa");
      show("tpu-requirements", backend === "tpu");
      show("chat-request", requestType === "chat");

      setText("setup-title", native ? "Install LLMD" : "Pull the LLMD image");
      const sourceHints = {
        hub: "Fetch the weights from Hugging Face when LLMD starts.",
        download: "Download the weights before starting LLMD.",
        local: "Use weights already on this machine.",
      };
      setText("source-hint", sourceHints[source]);
      setText("requirements", backendOptions.requirements);
      setText("selected-checkpoint", checkpoint);
      const published = legacyPreset || preset;
      setText("fit", published?.evidence ?? (published ? "A published recipe is available for this model and platform."
        : "Check support for this model on the selected platform."));
      for (const code of codeBlocks) updateCode(code, commands[code.dataset.command]);
    }

    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("input", event => {
      if ([checkpointField, backendField, drafterField].includes(event.target)) {
        legacyPreset = null;
        invalidLink = false;
      }
      if (event.target === checkpointField) {
        refreshDrafters();
        refreshRequest(requestField.value);
        updateCheckpointDirectory();
      }
      render();
    });

    function renderFragment(readQuery = false) {
      const fragment = window.location.hash.slice(1);
      const target = document.getElementById(fragment);
      if (target?.matches("a[data-moved-topic]")) {
        window.location.replace(target.href);
        return;
      }
      // A named bookmark overrides the default recipe carried by a legacy alias.
      if (!applyPreset(fragment)) {
        if (readQuery) applyQuery();
        applyFragment(fragment);
      }
      render();
      if (!root.contains(target)) return;
      const destination = target.closest("[hidden]") ? document.getElementById("choose-model") : target;
      for (let details = destination.closest("details"); root.contains(details); details = details.parentElement.closest("details")) {
        details.open = true;
      }
      destination.scrollIntoView();
    }
    window.addEventListener("hashchange", () => {
      renderFragment(!window.location.hash);
    });
    // A repeated table-of-contents link must reopen a step even when its hash is unchanged.
    document.addEventListener("click", event => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target.closest('a[href^="#"]');
      if (link?.hash && link.hash === window.location.hash && root.contains(document.getElementById(link.hash.slice(1)))) {
        renderFragment();
      }
    });

    refreshDrafters();
    refreshRequest("chat");
    for (const control of root.querySelectorAll("[data-launch-control]")) control.hidden = false;
    renderFragment(true);
  }
})();
