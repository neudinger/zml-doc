(() => {
  const prism = window.Prism;
  if (!prism) return;

  prism.languages.insertBefore("bash", "function", {
    "zml-command": {
      pattern: /(^[ \t]*)(?:bazel|bazelisk|brew|llmd|nvidia-smi|zml-smi)(?=\s|$)/m,
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

  for (const code of document.querySelectorAll(".prose pre > code[class]")) {
    const fence = code.classList[0];
    // Starlark uses Python syntax for the constructs in the Bazel examples.
    const language = fence === "starlark" ? "python" : fence;
    if (language === "text" || !Object.hasOwn(prism.languages, language)) continue;

    const highlighted = document.createDocumentFragment();
    appendTokens(highlighted, prism.tokenize(code.textContent, prism.languages[language]));
    code.replaceChildren(highlighted);
  }
})();
