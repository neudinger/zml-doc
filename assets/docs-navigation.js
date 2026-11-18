const sidebar = document.querySelector(".docs-sidebar");

if (sidebar) {
  const summary = sidebar.querySelector("summary");
  const narrowViewport = window.matchMedia("(max-width: 48rem)");
  const topics = Array.from(sidebar.querySelectorAll('a[href*="#"]')).filter(
    link => link.pathname === location.pathname
  );

  if (topics.length) {
    function syncTopic() {
      const current = topics.find(link => link.hash === location.hash) ?? topics[0];
      for (const link of topics) {
        link.setAttribute("aria-current", link === current ? "location" : "false");
      }
    }
    window.addEventListener("hashchange", syncTopic);
    syncTopic();
  }

  function syncSidebar() {
    if (narrowViewport.matches) {
      if (!sidebar.contains(document.activeElement)) sidebar.open = false;
      return;
    }

    sidebar.open = true;
    if (document.activeElement === summary) {
      const nextLink = sidebar.querySelector('a[aria-current]:not([aria-current="false"])') ?? sidebar.querySelector("a");
      nextLink?.focus();
    }
  }

  narrowViewport.addEventListener("change", syncSidebar);
  syncSidebar();
}

const referenceTables = document.querySelectorAll(".prose > table");
if (referenceTables.length) {
  const naturalWidths = new WeakMap();
  const resize = new ResizeObserver(entries => {
    for (const { target: region, contentRect } of entries) {
      region.toggleAttribute("data-needs-wrap", contentRect.width < naturalWidths.get(region));
      if (region.scrollWidth > region.clientWidth) region.tabIndex = 0;
      else region.removeAttribute("tabindex");
    }
  });

  for (const table of referenceTables) {
    const [head, ...rows] = table.rows;
    const columnCount = head?.cells.length;
    const plainRow = (row, tag) => row.cells.length === columnCount && Array.from(row.cells)
      .every(cell => cell.tagName === tag && cell.colSpan === 1 && cell.rowSpan === 1);
    if (!columnCount || !rows.length || table.tBodies.length !== 1 || table.tFoot ||
        table.tHead?.rows.length > 1 || !plainRow(head, "TH") || !rows.every(row => plainRow(row, "TD"))) continue;
    const labels = Array.from(head.cells, cell => cell.textContent.trim());
    const region = document.createElement("div");
    region.className = "reference-table";
    table.replaceWith(region);
    region.append(table);

    // Measure once before reflow. Short comparisons keep their columns when they fit.
    table.style.inlineSize = "max-content";
    naturalWidths.set(region, table.offsetWidth);
    table.style.removeProperty("inline-size");

    table.setAttribute("role", "table");
    table.createTHead().append(head);
    head.setAttribute("role", "row");
    for (const header of head.cells) {
      header.setAttribute("role", "columnheader");
      header.scope = "col";
    }
    for (const row of rows) {
      row.setAttribute("role", "row");
      for (const cell of row.cells) {
        cell.setAttribute("role", "cell");
        const label = document.createElement("span");
        label.className = "table-field-label";
        label.setAttribute("aria-hidden", "true");
        label.textContent = labels[cell.cellIndex];
        cell.prepend(label);
      }
    }
    resize.observe(region);
  }
}
