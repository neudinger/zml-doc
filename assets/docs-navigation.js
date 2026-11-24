const header = document.querySelector(".site-header");
if (header) {
  function measureHeader() {
    document.documentElement.style.setProperty("--docs-header-height", header.getBoundingClientRect().height + "px");
  }
  measureHeader();
  new ResizeObserver(measureHeader).observe(header);
}

function syncDisclosure(details, wideViewport) {
  if (!details) return;
  function update() {
    if (!wideViewport.matches) {
      if (!details.contains(document.activeElement)) details.open = false;
      return;
    }
    details.open = true;
    if (document.activeElement === details.querySelector("summary")) {
      const active = details.querySelector('a[aria-current="page"], a[aria-current="location"]');
      (active ?? details.querySelector("a"))?.focus({ preventScroll: true });
    }
  }
  wideViewport.addEventListener("change", update);
  update();
}

syncDisclosure(document.querySelector(".docs-sidebar"), window.matchMedia("(width > 48rem)"));

const contents = document.querySelector(".page-toc");
if (contents) {
  const disclosure = contents.querySelector("details");
  const wideViewport = window.matchMedia("(min-width: 68rem)");
  const article = contents.closest("article");
  const conditionalItems = new Map();
  for (const group of article.querySelectorAll("[data-toc-parent]")) {
    const parentLink = contents.querySelector(`a[href="#${CSS.escape(group.dataset.tocParent)}"]`);
    if (!parentLink) continue;
    const children = document.createElement("ul");
    for (const target of group.querySelectorAll("[id][data-toc-label]")) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#" + encodeURIComponent(target.id);
      link.textContent = target.dataset.tocLabel;
      conditionalItems.set(link, item);
      item.append(link);
      children.append(item);
    }
    parentLink.closest("li").append(children);
    new MutationObserver(scheduleSection).observe(group, {
      subtree: true, attributes: true, attributeFilter: ["hidden", "open"],
    });
  }
  const sections = Array.from(contents.querySelectorAll('a[href^="#"]'), link => ({
    link, id: decodeURIComponent(link.hash.slice(1)),
  }));
  const walkthrough = article.querySelector(".model-walkthrough, .weights-source-tabs");
  const sectionDisclosures = "details.model-source, details.client-disclosure, details.bazel-recipe";
  function revealSectionTarget(hash) {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const disclosure = target.closest(".client-branch")?.querySelector("details");
    if (disclosure) disclosure.open = true;
    else if (target.matches(sectionDisclosures)) target.open = true;
    else if (target === walkthrough) walkthrough.querySelector("input").checked = true;
    else if (target.control?.type === "radio" && walkthrough?.contains(target)) target.control.checked = true;
  }
  walkthrough?.addEventListener("change", event => {
    const label = event.target.closest("label[id]");
    if (!label) return;
    history.replaceState(history.state, "", "#" + label.id);
    followHash();
  });
  let currentLink;
  let requestedHash = location.hash;
  let landedAt = null;
  let frame = 0;
  syncDisclosure(disclosure, wideViewport);

  function syncSection() {
    frame = 0;
    const viewport = document.scrollingElement;
    const y = viewport.scrollTop;
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let first, passed, last, anchor;
    // Several sections near the footer can share a single attainable scroll position.
    // Honor the chosen anchor there until the reader scrolls away.
    if (landedAt !== null && Math.abs(y - landedAt) > 1) requestedHash = "";
    for (const { link, id } of sections) {
      const heading = document.getElementById(id);
      const hidden = !heading?.getClientRects().length;
      const item = conditionalItems.get(link);
      if (item && item.hidden !== hidden) item.hidden = hidden;
      // Bookmarks inside a closed disclosure can open it, but cannot mark the current section.
      if (hidden || heading.closest("details:not([open]) > :not(summary)")) continue;
      // Stage labels share a row. Only the selected stage represents the visible content.
      if (heading.control?.type === "radio" && !heading.control.checked) continue;
      const top = heading.getBoundingClientRect().top;
      first ??= link;
      last = link;
      if (top <= inset + 1) passed = link;
      if (link.hash === requestedHash) {
        const destination = Math.max(0, Math.min(maxY, y + top - inset));
        if (Math.abs(y - destination) <= 1) {
          anchor = link;
          landedAt = y;
        }
      }
    }
    const active = anchor ?? (y > 0 && y >= maxY - 1 ? last : passed ?? first);
    if (currentLink === active) return;
    currentLink?.removeAttribute("aria-current");
    active?.setAttribute("aria-current", "location");
    currentLink = active;
    if (active && wideViewport.matches && contents.scrollHeight > contents.clientHeight) {
      const rail = contents.getBoundingClientRect();
      const link = active.getBoundingClientRect();
      if (link.top < rail.top) contents.scrollTop += link.top - rail.top;
      else if (link.bottom > rail.bottom) contents.scrollTop += link.bottom - rail.bottom;
    }
  }

  function scheduleSection() {
    if (!frame) frame = requestAnimationFrame(syncSection);
  }
  function followHash() {
    requestedHash = location.hash;
    revealSectionTarget(requestedHash);
    landedAt = null;
    scheduleSection();
  }
  contents.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    requestedHash = link.hash;
    revealSectionTarget(requestedHash);
    landedAt = null;
    if (disclosure && !wideViewport.matches) {
      const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      disclosure.open = false;
      if (heading) {
        const focusTarget = heading.matches(sectionDisclosures) ? heading.querySelector("summary") : heading.control ?? heading;
        if (!focusTarget.hasAttribute("tabindex") && focusTarget.tabIndex < 0) focusTarget.tabIndex = -1;
        // Move focus after the browser follows the fragment link.
        requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
    }
    scheduleSection();
  });
  window.addEventListener("scroll", scheduleSection, { passive: true });
  window.addEventListener("resize", scheduleSection);
  window.addEventListener("hashchange", followHash);
  window.addEventListener("pageshow", followHash);
  new ResizeObserver(scheduleSection).observe(article);
  followHash();
}

for (const heading of document.querySelectorAll(".prose :is(h2, h3, h4, h5, h6)")) {
  // Some configurator sections keep the bookmark on their enclosing panel.
  const id = heading.id || heading.parentElement.id;
  const title = heading.dataset.tocLabel ?? heading.textContent.trim();
  if (!id || !title) continue;
  const link = document.createElement("a");
  link.className = "section-permalink icon-link";
  link.href = "#" + encodeURIComponent(id);
  link.setAttribute("aria-label", "Link to " + title);
  heading.append(link);
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
