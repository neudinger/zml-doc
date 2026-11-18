(() => {
  const languageNames = new Map([
    ["bash", "Bash"], ["sh", "Shell"], ["json", "JSON"], ["promql", "PromQL"],
    ["starlark", "Starlark"], ["yaml", "YAML"], ["zig", "Zig"], ["text", "Plain text"],
  ]);
  const status = document.createElement("span");
  status.className = "code-copy-status";
  status.setAttribute("role", "status");
  document.body.append(status);

  for (const code of document.querySelectorAll(".prose pre > code")) {
    const pre = code.parentElement;
    const block = document.createElement("div");
    block.className = "code-block";
    const header = document.createElement("div");
    header.className = "code-block-header";
    const previous = pre.previousElementSibling;
    const label = previous?.matches(".command-language") ? previous : document.createElement("span");
    if (!label.textContent.trim()) {
      const language = code.classList[0]?.replace(/^language-/, "") || "text";
      label.textContent = languageNames.get(language) ?? language;
    }
    label.classList.add("command-language", "icon-code");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", code.dataset.copyLabel || "Copy code");

    let resetTimer;
    let copying = false;
    let version = 0;
    code.addEventListener("codechange", () => {
      version++;
      clearTimeout(resetTimer);
      button.textContent = "Copy";
      status.textContent = "";
    });
    button.addEventListener("click", async () => {
      if (copying) return;
      copying = true;
      clearTimeout(resetTimer);
      status.textContent = "";
      const copiedVersion = version;

      try {
        await navigator.clipboard.writeText(code.textContent);
        if (version !== copiedVersion) return;
        button.textContent = "Copied";
        status.textContent = "Code copied to clipboard.";
      } catch {
        if (version !== copiedVersion) return;
        button.textContent = "Select code to copy";
        status.textContent = "Clipboard unavailable. Select the code to copy it.";
      } finally {
        copying = false;
        if (version === copiedVersion) {
          resetTimer = setTimeout(() => { button.textContent = "Copy"; }, 3000);
        }
      }
    });

    pre.replaceWith(block);
    header.append(label, button);
    block.append(header, pre);
  }
})();
