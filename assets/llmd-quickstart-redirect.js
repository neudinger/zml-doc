(() => {
  const link = document.querySelector("[data-quickstart-redirect]");
  const target = new URL(link.href);
  const fragment = window.location.hash;
  target.search = window.location.search;
  const params = target.searchParams;
  const preset = target.hash.slice(1);
  const hasSelection = params.has("recipe") || (params.has("backend") && (params.has("model") || params.has("checkpoint")));

  if (link.dataset.quickstartRedirect === "docker") {
    if (fragment) target.hash = fragment;
    else if (hasSelection) target.hash = "";
  } else if (["#before-you-start", "#install-llmd", "#start-the-server", "#check-the-loaded-model", "#send-a-chat-request", "#troubleshooting", "#next-steps"].includes(fragment)) {
    if (!hasSelection) params.set("recipe", preset);
    target.hash = fragment;
  } else if (hasSelection) {
    target.hash = "";
  }

  window.location.replace(target);
})();
