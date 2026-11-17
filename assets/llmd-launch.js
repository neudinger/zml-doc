(() => {
  const sourceNotes = {
    download: "Save a checkpoint on the Docker host, then mount it read-only.",
    local: "Mount the existing checkpoint read-only from the Docker host.",
    hub: "LLMD reads the checkpoint from Hugging Face at startup.",
  };
  const backends = {
    cuda: { defaultRelease: "20261106.0", shm: "256GB", devices: [] },
    rocm: { defaultRelease: "20261029.0", shm: "256GB", devices: ["--device=/dev/kfd", "--device=/dev/dri"] },
    oneapi: { defaultRelease: "20261029.0", shm: "", devices: ["--device=/dev/dri"] },
  };
  const presets = [
    { id: "lfm3-fp8-cuda", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "cuda", release: "20261106.0" },
    { id: "lfm3-fp8-rocm", checkpoint: "LiquidAI/LFM3-1.7B-FP8", backend: "rocm", release: "20261029.0" },
    { id: "lfm3-oneapi", checkpoint: "LiquidAI/LFM3-1.7B", backend: "oneapi", release: "20261029.0" },
    { id: "qwen3-8-27b-cuda", checkpoint: "Qwen/Qwen3.8-27B", backend: "cuda", release: "20261112.0", dspine: true },
    { id: "qwen3-8-27b-rocm", checkpoint: "Qwen/Qwen3.8-27B", backend: "rocm", release: "20261112.0", dspine: true },
    { id: "qwen3-8-27b-oneapi", checkpoint: "Qwen/Qwen3.8-27B", backend: "oneapi", release: "20261112.0" },
  ];
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

  function integerError(value, max, required = false) {
    if (!value && !required) return "";
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max) return "";
    return "Enter a whole number from 1 to " + max.toLocaleString("en-US") + " using digits only.";
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

  function downloadCommand({ checkpoint, directory, revision }) {
    const lines = ["uvx --from huggingface_hub hf download " + shellQuote(checkpoint)];
    if (revision) lines.push("  --revision " + shellQuote(revision));
    lines.push("  --local-dir " + homePath(directory));
    return lines.join(continuation);
  }

  function servedModelName(checkpoint) {
    return checkpoint.split("/").at(-1);
  }

  function localApiUrl(port, endpoint) {
    return "http://127.0.0.1:" + Number(port) + "/v1/" + endpoint;
  }

  function launchCommand(settings, image, backendOptions) {
    const { backend, checkpoint, directory, source, revision } = settings;
    const localCheckpoint = source !== "hub";
    const localDrafter = settings.drafterSource === "local";
    const mounts = [];
    if (localCheckpoint) mounts.push({ name: "model", directory });
    if (localDrafter) mounts.push({ name: "drafter", directory: drafterDirectory });

    const lines = [
      "docker run " + (settings.runMode === "foreground" ? "--rm" : "-d") + " --name llmd",
      "  -p 127.0.0.1:" + Number(settings.port) + ":8000",
      ...backendOptions.devices.map(flag => "  " + flag),
    ];
    if (backend === "cuda") lines.push("  --gpus=" + shellQuote(settings.gpu));
    const shm = settings.shm === "recipe" ? backendOptions.shm : settings.shm;
    if (shm && shm !== "default") lines.push("  --shm-size=" + shellQuote(shm));
    // Docker expects CSV, including quotes around the entire source field.
    for (const { name } of mounts) {
      lines.push('  --mount "type=bind,\\"source=${' + name + '_src}\\",target=/' + name + ',readonly"');
    }
    if (settings.hfToken) lines.push("  -e HF_TOKEN");
    const model = localCheckpoint ? "/model" : "hf://" + checkpoint + (revision ? "@" + revision : "");
    lines.push("  " + image, "  --model=" + shellQuote(model), "  --model-name=" + shellQuote(servedModelName(checkpoint)));
    if (settings.dspine) {
      const drafter = localDrafter ? "/drafter" : "hf://" + drafterCheckpoint;
      lines.push("  --speculative-drafter-model=" + shellQuote(drafter), "  --batch-size=1");
    }
    for (const [name, flag] of overrides) {
      if (settings[name]) lines.push("  --" + flag + "=" + Number(settings[name]));
    }
    const command = lines.join(continuation);
    if (!mounts.length) return command;

    return [
      "(",
      '  case "${HOME:?Set HOME to your absolute home directory}" in',
      "    /*) ;;",
      "    *) printf '%s\\n' 'HOME must be an absolute path.' >&2; exit 1 ;;",
      "  esac",
      ...mounts.map(({ name, directory }) =>
        "  " + name + "_src=$(printf '%s' " + homePath(directory) + " | sed 's/\"/\"\"/g') || exit 1"
      ),
      command.replace(/^/gm, "  "),
      ")",
    ].join("\n");
  }

  function chatCommand({ checkpoint, port }) {
    const payload = JSON.stringify({
      model: servedModelName(checkpoint),
      messages: [{ role: "user", content: "Reply with one short greeting." }],
    }, null, 2);
    return [
      "curl -fsS " + localApiUrl(port, "chat/completions"),
      "  -H 'Content-Type: application/json'",
      "  -d " + shellQuote(payload.replaceAll("\n", "\n  ")),
    ].join(continuation);
  }

  function updateCode(code, value) {
    if (code.textContent === value) return;
    code.textContent = value;
    code.dispatchEvent(new Event("codechange", { bubbles: true }));
  }

  for (const root of document.querySelectorAll("[data-llmd-launch]")) {
    const form = root.querySelector("form");
    const part = name => root.querySelector(`[data-${name}]`);
    const download = root.querySelector('code[data-command="download"]');
    const drafterDownload = root.querySelector('code[data-command="drafter-download"]');
    const launch = root.querySelector('code[data-command="launch"]');
    const models = root.querySelector('code[data-command="models"]');
    const chat = root.querySelector('code[data-command="chat"]');
    const checkpointField = form.elements.namedItem("checkpoint");
    const backendField = form.elements.namedItem("backend");
    const dspineField = form.elements.namedItem("dspine");
    const drafterSourceField = form.elements.namedItem("drafterSource");
    const hfTokenField = form.elements.namedItem("hfToken");
    const batchField = form.elements.namedItem("batch");
    let checkpoint = checkpointField.value;

    function updateCheckpointDirectory() {
      const nextCheckpoint = checkpointField.value;
      if (nextCheckpoint === checkpoint) return;

      form.elements.namedItem("directory").value = homePrefix + "/models/" + nextCheckpoint;
      form.elements.namedItem("revision").value = "";
      checkpoint = nextCheckpoint;
    }

    function applyPreset() {
      const preset = presets.find(item => window.location.hash === "#" + item.id);
      if (!preset || ![...backendField.options].some(option => option.value === preset.backend)
          || ![...checkpointField.options].some(option => option.value === preset.checkpoint)) return;

      backendField.value = preset.backend;
      checkpointField.value = preset.checkpoint;
      dspineField.checked = false;
      drafterSourceField.value = "hub";
      updateCheckpointDirectory();
    }

    function render() {
      const backend = backendField.value;
      const checkpoint = checkpointField.value;
      const preset = presets.find(item => item.checkpoint === checkpoint && item.backend === backend);
      const supportsDspine = !!preset?.dspine;
      if (!supportsDspine) dspineField.checked = false;
      dspineField.disabled = !supportsDspine;
      part("dspine").hidden = !supportsDspine;
      drafterSourceField.disabled = !dspineField.checked;
      part("drafter-source").hidden = drafterSourceField.disabled;
      batchField.disabled = dspineField.checked;
      part("batch").hidden = batchField.disabled;

      const source = form.elements.namedItem("source").value;
      const drafterSource = drafterSourceField.disabled ? "" : drafterSourceField.value;
      hfTokenField.disabled = source !== "hub" && drafterSource !== "hub";
      const settings = Object.fromEntries(new FormData(form));
      const backendOptions = backends[backend];
      const gemmaCuda = checkpoint === "google/gemma-4-31B-it" && backend === "cuda";
      const tag = gemmaCuda ? "cuda" : `${preset?.release ?? backendOptions.defaultRelease}-${backend}`;
      const image = "zmlai/llmd:" + tag;
      const errors = {
        directory: source === "hub" ? "" : directoryError(settings.directory),
        revision: source !== "local" && settings.revision && !/^[a-f0-9]{40}$/i.test(settings.revision)
          ? "Enter exactly 40 hexadecimal characters (0–9 or a–f), or clear this field."
          : "",
        port: integerError(settings.port, 65535, true),
        context: integerError(settings.context, 0xffffffff),
        batch: integerError(settings.batch, 0xffffffff),
        tokens: integerError(settings.tokens, 0xffffffff),
        memory: memoryError(settings.memory),
      };
      for (const [name, error] of Object.entries(errors)) {
        const message = root.querySelector('[data-field-error="' + name + '"]');
        if (message.textContent === error) continue;
        const field = form.elements.namedItem(name);
        if (error) field.setAttribute("aria-invalid", "true");
        else field.removeAttribute("aria-invalid");
        message.textContent = error;
      }
      const hasErrors = Object.values(errors).some(Boolean);
      const showDownload = source === "download" && !errors.directory && !errors.revision;
      const showDrafterDownload = drafterSource === "local";

      part("local").hidden = source === "hub";
      part("revision").hidden = source === "local";
      part("hub").hidden = hfTokenField.disabled;
      part("cuda").hidden = backend !== "cuda";
      part("download-step").hidden = !showDownload;
      part("drafter-download-step").hidden = !showDrafterDownload;
      part("launch-output").hidden = hasErrors;
      part("models-step").hidden = hasErrors;
      part("chat-step").hidden = hasErrors;
      part("error").hidden = !hasErrors;
      part("hint").textContent = sourceNotes[source];
      part("recipe").textContent = gemmaCuda
        ? "ZML published a DFlash recipe for this checkpoint on the CUDA rolling image."
        : preset
          ? `${settings.dspine ? "DSpine" : "Base-model"} launch with LLMD ${preset.release}.`
          : "Confirm compatibility for this checkpoint, backend, and image.";
      updateCode(download, showDownload ? downloadCommand(settings) : "");
      updateCode(drafterDownload, showDrafterDownload
        ? downloadCommand({ checkpoint: drafterCheckpoint, directory: drafterDirectory }) : "");
      updateCode(launch, hasErrors ? "" : launchCommand(settings, image, backendOptions));
      updateCode(models, hasErrors ? "" : "curl -fsS " + localApiUrl(settings.port, "models"));
      part("expected-model-id").textContent = hasErrors ? "" : servedModelName(checkpoint);
      updateCode(chat, hasErrors ? "" : chatCommand(settings));
    }

    form.addEventListener("submit", event => event.preventDefault());
    form.addEventListener("input", () => {
      updateCheckpointDirectory();
      render();
    });

    window.addEventListener("hashchange", () => {
      applyPreset();
      render();
    });

    applyPreset();
    render();
    form.hidden = false;
  }
})();
