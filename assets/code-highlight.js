(() => {
  const prism = window.Prism;
  if (!prism) return;

  prism.languages.insertBefore("bash", "function", {
    "zml-command": {
      pattern: /(^[ \t]*)(?:bazel|bazelisk|brew|docker|llmd|nvidia-smi|uvx|zml-smi)(?=\s|$)/m,
      lookbehind: true,
      alias: "function",
    },
    "zml-backend-flag": {
      pattern: /(^|[ \t])--@zml\/\/platforms:[a-z]+=(?:true|false)(?=\s|$)/m,
      lookbehind: true,
      alias: "attr-name",
    },
  });

  function appendTokens(parent, tokens) {
    for (const token of tokens) {
      if (typeof token === "string") {
        parent.append(token);
        continue;
      }

      const span = document.createElement("span");
      span.classList.add("token", token.type);
      if (token.alias) span.classList.add(...[].concat(token.alias));
      appendTokens(span, [].concat(token.content));
      parent.append(span);
    }
  }

  function highlight(code) {
    const fence = code.classList[0];
    // Starlark uses Python syntax for the constructs in the Bazel examples.
    const language = fence === "starlark" ? "python" : fence;
    if (language === "text" || !Object.hasOwn(prism.languages, language)) return;

    const highlighted = document.createDocumentFragment();
    appendTokens(highlighted, prism.tokenize(code.textContent, prism.languages[language]));
    code.replaceChildren(highlighted);
  }

  const codeSelector = ".prose pre > code[class]";
  for (const code of document.querySelectorAll(codeSelector)) highlight(code);
  document.addEventListener("codechange", event => {
    if (event.target.matches(codeSelector)) highlight(event.target);
  });
})();
