(() => {
  const link = document.querySelector("[data-quickstart-redirect]");
  const target = new URL(link.href);
  const fragment = window.location.hash;

  if (link.dataset.quickstartRedirect === "docker") {
    if (fragment) target.hash = fragment;
  } else {
    if (["#before-you-start", "#install-llmd", "#start-the-server", "#check-the-loaded-model", "#send-a-chat-request", "#troubleshooting", "#next-steps"].includes(fragment)) {
      target.searchParams.set("recipe", target.hash.slice(1));
      target.hash = fragment;
    }
  }

  window.location.replace(target);
})();
