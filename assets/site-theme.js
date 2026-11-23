(() => {
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const preferenceKey = "zml-site-theme";
  const defaultTheme = root.dataset.theme;

  function savedTheme() {
    try {
      const preference = window.localStorage.getItem(preferenceKey);
      return preference === "light" || preference === "dark" ? preference : defaultTheme;
    } catch {
      return defaultTheme;
    }
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.dataset.pfTheme = theme;
    themeColor?.setAttribute("content", theme === "dark" ? "#0d0c14" : "#ffffff");
  }

  applyTheme(savedTheme());

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector(".theme-toggle");
    if (!button) return;

    function showTheme(theme) {
      applyTheme(theme);
      button.setAttribute("aria-pressed", String(theme === "dark"));
    }

    showTheme(root.dataset.theme);
    button.addEventListener("click", () => {
      const theme = root.dataset.theme === "dark" ? "light" : "dark";
      showTheme(theme);
      try {
        window.localStorage.setItem(preferenceKey, theme);
      } catch {
        // The current page can still switch themes when storage is unavailable.
      }
    });

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) showTheme(savedTheme());
    });
    button.hidden = false;
  }, { once: true });
})();
