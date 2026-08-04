const TABLE_SELECTOR =
  ".sl-markdown-content table:not(.options-table table):not([data-scroll-table])";
const SCROLL_THRESHOLD = 1;

function syncScrollState(container: HTMLElement, viewport: HTMLElement) {
  const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
  const canScroll = maxScrollLeft > SCROLL_THRESHOLD;

  container.toggleAttribute(
    "data-shadow-left",
    canScroll && viewport.scrollLeft > SCROLL_THRESHOLD,
  );
  container.toggleAttribute(
    "data-shadow-right",
    canScroll && viewport.scrollLeft < maxScrollLeft - SCROLL_THRESHOLD,
  );

  if (canScroll) {
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute("aria-label", "Scrollable table");
  } else {
    viewport.removeAttribute("tabindex");
    viewport.removeAttribute("role");
    viewport.removeAttribute("aria-label");
  }
}

function enhanceTable(table: HTMLTableElement) {
  table.dataset.scrollTable = "";

  const container = document.createElement("div");
  container.className = "table-scroll";

  const viewport = document.createElement("div");
  viewport.className = "table-scroll__viewport";

  table.before(container);
  container.append(viewport);
  viewport.append(table);

  let frame = 0;
  const scheduleSync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => syncScrollState(container, viewport));
  };

  viewport.addEventListener("scroll", scheduleSync, { passive: true });

  const observer = new ResizeObserver(scheduleSync);
  observer.observe(viewport);
  observer.observe(table);

  scheduleSync();
}

function enhanceTables() {
  let tables: HTMLTableElement[] | NodeListOf<HTMLTableElement>;

  try {
    tables = document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR);
  } catch {
    tables = Array.from(
      document.querySelectorAll<HTMLTableElement>(".sl-markdown-content table"),
    ).filter(
      (table) =>
        !table.closest(".options-table") &&
        !table.hasAttribute("data-scroll-table"),
    );
  }

  tables.forEach(enhanceTable);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhanceTables, { once: true });
} else {
  enhanceTables();
}
