(() => {
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const preferenceKey = "zml-site-theme";
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");

  function systemTheme() {
    return systemPreference.matches ? "dark" : "light";
  }

  function savedTheme() {
    try {
      const preference = window.localStorage.getItem(preferenceKey);
      return preference === "light" || preference === "dark" ? preference : null;
    } catch {
      return null;
    }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.dataset.pfTheme = theme;
    themeColor?.setAttribute("content", theme === "dark" ? "#0d0c14" : "#ffffff");
  }

  let override = savedTheme();
  let button;

  function showTheme() {
    const theme = override ?? systemTheme();
    applyTheme(theme);
    button?.setAttribute("aria-pressed", String(theme === "dark"));
  }

  showTheme();
  systemPreference.addEventListener("change", showTheme);

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      override = savedTheme();
      showTheme();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    button = document.querySelector(".theme-toggle");
    if (!button) return;

    showTheme();
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      // Only a user interaction can clear an override that matches the OS.
      override = theme === systemTheme() ? null : theme;
      showTheme();
      try {
        if (override) window.localStorage.setItem(preferenceKey, override);
        else window.localStorage.removeItem(preferenceKey);
      } catch {
        // The current page can still switch themes when storage is unavailable.
      }
    });

    button.hidden = false;
  }, { once: true });
})();
