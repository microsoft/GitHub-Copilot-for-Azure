// Repository Health Dashboard — ES Module
// SECURITY: NEVER use innerHTML, outerHTML, insertAdjacentHTML, or document.write.
// ALL content rendered via textContent, createTextNode, createElement, setAttribute.

// ── Panel Registry ──────────────────────────────────────────────────────────

/** @type {Record<string, (section: HTMLElement, category: object) => void>} */
const panelRenderers = {};

// ── Thresholds ──────────────────────────────────────────────────────────────

/** Minimum passing rate for skill invocation tests (0–1). */
const SIR_THRESHOLD = 0.8;
const SIR_THRESHOLD_PCT = Math.round(SIR_THRESHOLD * 100);

/** Minimum passing rate for end-to-end tests per skill (0–1). */
const E2E_THRESHOLD = 0.7;
const E2E_THRESHOLD_PCT = Math.round(E2E_THRESHOLD * 100);

/**
 * Register a renderer function for a named category.
 * @param {string} name - Category key from the report.
 * @param {(section: HTMLElement, category: object) => void} renderer
 */
export function registerPanel(name, renderer) {
  panelRenderers[name] = renderer;
}

// ── DOM Helpers ─────────────────────────────────────────────────────────────

/**
 * Create an element with optional class and text content.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Create a status badge span.
 * @param {string} status - pass | fail | warn | skip
 * @returns {HTMLElement}
 */
function statusBadge(status) {
  const badge = el("span", "status-badge", status);
  badge.setAttribute("data-status", status);
  return badge;
}

/**
 * Create a stat box (value + label).
 * @param {string|number} value
 * @param {string} label
 * @returns {HTMLElement}
 */
function statBox(value, label) {
  const box = el("div", "stat-box");
  box.appendChild(el("span", "stat-value", String(value)));
  box.appendChild(el("span", "stat-label", label));
  return box;
}

/**
 * Create a clickable stat box that filters items by status.
 * Clicking toggles a filter on the items container. Clicking the active
 * filter again shows all items.  Uses aria-pressed for accessibility.
 * @param {string|number} value
 * @param {string} label
 * @param {string} filterStatus - the status value to filter by (pass/warn/fail)
 * @param {HTMLElement} itemsContainer - the container whose children will be filtered
 * @returns {HTMLElement}
 */
function filterableStatBox(value, label, filterStatus, itemsContainer) {
  const box = el("button", "stat-box stat-box-filter");
  box.setAttribute("type", "button");
  box.setAttribute("aria-pressed", "false");
  box.setAttribute("data-filter-status", filterStatus);
  box.setAttribute("aria-label", "Filter: show " + label + " items");
  box.appendChild(el("span", "stat-value", String(value)));
  box.appendChild(el("span", "stat-label", label));

  box.addEventListener("click", function () {
    const isActive = box.getAttribute("aria-pressed") === "true";

    // Deactivate all sibling filter boxes
    const parent = box.parentElement;
    if (parent) {
      const siblings = parent.querySelectorAll(".stat-box-filter");
      for (let i = 0; i < siblings.length; i++) {
        siblings[i].setAttribute("aria-pressed", "false");
      }
    }

    // Find all filterable items (works regardless of nesting depth)
    var items = itemsContainer.querySelectorAll("[data-item-status]");
    if (isActive) {
      // Show all items
      for (let j = 0; j < items.length; j++) {
        items[j].style.display = "";
      }
    } else {
      // Activate this filter
      box.setAttribute("aria-pressed", "true");
      for (let k = 0; k < items.length; k++) {
        var itemStatus = items[k].getAttribute("data-item-status");
        items[k].style.display = itemStatus === filterStatus ? "" : "none";
      }
    }
  });

  return box;
}

/**
 * Render clickable/filterable summary stat boxes.
 * Clicking a stat box filters the items container to show only items
 * with the matching status.  Clicking again resets to show all.
 * @param {HTMLElement} container - Where to append the stats row
 * @param {object} summary - { total, passed, failed, warnings, skipped }
 * @param {HTMLElement} itemsContainer - The items container to filter
 */
function renderFilterableSummaryStats(container, summary, itemsContainer) {
  const row = el("div", "stats-row");
  row.appendChild(statBox(summary.total, "Total"));
  row.appendChild(filterableStatBox(summary.passed, "Passed", "pass", itemsContainer));
  if (summary.failed > 0)
    row.appendChild(filterableStatBox(summary.failed, "Failed", "fail", itemsContainer));
  if (summary.warnings > 0)
    row.appendChild(filterableStatBox(summary.warnings, "Warnings", "warn", itemsContainer));
  if (summary.skipped > 0)
    row.appendChild(filterableStatBox(summary.skipped, "Skipped", "skip", itemsContainer));
  container.appendChild(row);
}



/**
 * Return the CSS color variable for a token item status.
 * Token bars use item status: fail = over budget, warn = near limit, pass = within budget.
 * @param {string} status - pass | warn | fail
 * @returns {string}
 */
function tokenBarColor(status) {
  if (status === "fail") return "var(--color-fail)";
  if (status === "warn") return "var(--color-warn)";
  return "var(--color-pass)";
}

/**
 * Create a horizontal progress bar for token usage.
 * Color is determined by item status (pass/warn/fail), not raw percentage.
 * @param {string} label
 * @param {number} percent - 0–100+, may exceed 100 for over-budget items
 * @param {string} status - pass | warn | fail
 * @returns {HTMLElement}
 */
function tokenBar(label, percent, status) {
  const clamped = Math.max(0, Math.min(100, percent));
  const container = el("div", "progress-bar-container token-bar");

  container.appendChild(el("span", "progress-bar-label", label));

  const track = el("div", "progress-bar-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuenow", String(Math.round(clamped)));
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-label", label + " token usage");

  const fill = el("div", "progress-bar-fill token-bar-fill");
  fill.style.width = clamped + "%";
  fill.style.backgroundColor = tokenBarColor(status);
  fill.setAttribute("data-status", status || "pass");
  track.appendChild(fill);

  container.appendChild(track);

  // Show the actual percent (may exceed 100% for over-budget items)
  const displayPct = Math.round(percent);
  container.appendChild(el("span", "progress-bar-value", displayPct + "%"));

  return container;
}

/**
 * Build a token-specific summary string with contextual labels.
 * @param {object} summary - { total, passed, failed, warnings, skipped }
 * @returns {string}
 */
function buildTokensSummaryText(summary) {
  if (!summary) return "";
  const parts = [];
  if (summary.failed > 0) parts.push(summary.failed + " over budget");
  if (summary.warnings > 0) parts.push(summary.warnings + " near limit");
  parts.push(summary.passed + " within budget");
  return parts.join(" / ");
}

/**
 * Truncate a file path for display.
 * @param {string} name
 * @returns {string}
 */
function shortName(name) {
  const parts = name.replace(/\\/g, "/").split("/");
  if (parts.length <= 3) return parts.join("/");
  return "…/" + parts.slice(-2).join("/");
}

// ── Summary Text Helper ─────────────────────────────────────────────────────

/**
 * Build a human-readable summary string from category stats.
 * @param {object} summary - { total, passed, failed, warnings, skipped }
 * @returns {string}
 */
function buildSummaryText(summary) {
  if (!summary) return "";
  const parts = [];
  parts.push(summary.passed + " passed");
  parts.push(summary.failed + " failed");
  if (summary.warnings > 0) parts.push(summary.warnings + " warnings");
  if (summary.skipped > 0) parts.push(summary.skipped + " skipped");
  return parts.join(" / ");
}

// ── Header Renderer ─────────────────────────────────────────────────────────

/**
 * Render the dashboard header with prominent health card and metadata.
 * @param {object} report
 */
function renderHeader(report) {
  const container = document.getElementById("header-summary");
  if (!container) return;
  container.textContent = "";

  // Calculate health
  const categories = report.categories || {};
  const entries = Object.values(categories);
  const nonSkipped = entries.filter((c) => c.status !== "skip");
  const passing = nonSkipped.filter((c) => c.status === "pass");
  const healthPct =
    nonSkipped.length > 0
      ? Math.round((passing.length / nonSkipped.length) * 100)
      : 0;

  // Health card — large colored percentage
  const healthCard = el("div", "header-health-card");
  const healthNumber = el("span", "header-health-number", healthPct + "%");
  const healthLevel =
    healthPct >= 80 ? "good" : healthPct >= 50 ? "moderate" : "poor";
  healthNumber.setAttribute("data-health", healthLevel);
  healthCard.appendChild(healthNumber);
  healthCard.appendChild(el("span", "header-health-label", "overall health"));
  container.appendChild(healthCard);

  // Meta card — branch, commit, timestamp
  const metaCard = el("div", "header-meta-card");

  /** @param {string} label @param {string} value */
  function addMetaItem(label, value) {
    const item = el("div", "header-meta-item");
    item.appendChild(el("span", "header-meta-label", label));
    item.appendChild(el("span", "header-meta-value", value));
    metaCard.appendChild(item);
  }

  addMetaItem("Branch", report.branch || "unknown");
  addMetaItem(
    "Commit",
    report.commit ? report.commit.slice(0, 7) : "unknown",
  );
  addMetaItem(
    "Generated",
    report.generatedAt
      ? new Date(report.generatedAt).toLocaleString()
      : "unknown",
  );

  container.appendChild(metaCard);

  // Status row — pass/fail/warn/skip counts across categories
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  let skipCount = 0;
  for (const cat of entries) {
    if (cat.status === "pass") passCount++;
    else if (cat.status === "fail") failCount++;
    else if (cat.status === "warn") warnCount++;
    else if (cat.status === "skip") skipCount++;
  }

  const statusRow = el("div", "header-status-row");

  /** @param {number} count @param {string} label @param {string} status */
  function addPill(count, label, status) {
    if (count > 0) {
      const pill = el("button", "header-status-pill");
      pill.setAttribute("type", "button");
      pill.setAttribute("data-status", status);
      pill.setAttribute("aria-pressed", "false");
      pill.setAttribute(
        "aria-label",
        count + " " + label + " \u2014 click to filter",
      );
      pill.appendChild(el("span", "header-status-count", String(count)));
      pill.appendChild(document.createTextNode(" " + label));
      pill.addEventListener("click", function () {
        toggleHeaderFilter(status);
      });
      statusRow.appendChild(pill);
    }
  }

  addPill(passCount, "pass", "pass");
  addPill(failCount, "fail", "fail");
  addPill(warnCount, "warn", "warn");
  addPill(skipCount, "skip", "skip");

  // Expand All / Collapse All button
  const expandAllBtn = el("button", "expand-collapse-btn", "Expand All");
  expandAllBtn.setAttribute("type", "button");
  expandAllBtn.setAttribute("aria-label", "Expand all panel sections");
  let allExpanded = false;
  expandAllBtn.addEventListener("click", function () {
    allExpanded = !allExpanded;
    const headers = document.querySelectorAll(".panel-header");
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      h.setAttribute("aria-expanded", String(allExpanded));
      const bodyId = h.getAttribute("aria-controls");
      const body = bodyId ? document.getElementById(bodyId) : null;
      if (body) {
        if (allExpanded) {
          body.classList.remove("collapsed");
          body.setAttribute("aria-hidden", "false");
        } else {
          body.classList.add("collapsed");
          body.setAttribute("aria-hidden", "true");
        }
      }
      const chev = h.querySelector(".panel-chevron");
      if (chev) chev.textContent = allExpanded ? "\u25B2" : "\u25BC";
    }
    expandAllBtn.textContent = allExpanded ? "Collapse All" : "Expand All";
    expandAllBtn.setAttribute(
      "aria-label",
      allExpanded ? "Collapse all panel sections" : "Expand all panel sections",
    );
  });
  statusRow.appendChild(expandAllBtn);

  container.appendChild(statusRow);
}

// ── Header Filter Helpers ───────────────────────────────────────────────────

/**
 * Toggle a status in the global filter from a header pill click.
 * @param {string} status
 */
function toggleHeaderFilter(status) {
  if (activeGlobalFilters.has(status)) {
    activeGlobalFilters.delete(status);
  } else {
    activeGlobalFilters.add(status);
  }
  updateHeaderPillStates();
  applyGlobalFilter();
  syncUrlHash();
}

/**
 * Update the visual state of all header status pills based on activeGlobalFilters.
 */
function updateHeaderPillStates() {
  var pills = document.querySelectorAll(".header-status-pill");
  for (var i = 0; i < pills.length; i++) {
    var s = pills[i].getAttribute("data-status");
    var active = activeGlobalFilters.has(s);
    pills[i].setAttribute("aria-pressed", String(active));
  }
}

// ── Collapsible Panel Setup ──────────────────────────────────────────────────

/**
 * Transform a panel section into a collapsible card.
 *
 * Replaces the static heading with a clickable header card that shows
 * the status badge, category name, and summary stats.  Panels with more
 * than 10 items default to the collapsed state.
 *
 * @param {HTMLElement} section - The panel section element
 * @param {object} category - Category data from the report
 * @param {string} name - Category key (used for element IDs)
 */
function setupCollapsible(section, category, name) {
  const h2 = section.querySelector("h2");
  const panelStatus = section.querySelector(".panel-status");
  const panelSummary = section.querySelector(".panel-summary");
  const panelItems = section.querySelector(".panel-items");

  if (!h2 || !panelSummary || !panelItems) return;

  const categoryName = h2.textContent || "";
  const items = category.items || [];
  const defaultCollapsed = items.length > 10;

  // Clickable header card
  const header = el("div", "panel-header");
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.setAttribute("aria-expanded", String(!defaultCollapsed));

  // Body wrapper
  const bodyId = "panel-body-" + name;
  const body = el("div", "panel-body");
  body.id = bodyId;
  header.setAttribute("aria-controls", bodyId);

  // Main row: badge + title + chevron
  const mainRow = el("div", "panel-header-main");
  mainRow.appendChild(statusBadge(category.status));
  mainRow.appendChild(el("h2", undefined, categoryName));
  const chevron = el("span", "panel-chevron");
  chevron.textContent = defaultCollapsed ? "\u25BC" : "\u25B2";
  mainRow.appendChild(chevron);

  // Panel-specific action links (GitHub Actions)
  var panelLinks = {
    tests: {
      text: "View All Workflows",
      href: "https://github.com/microsoft/GitHub-Copilot-for-Azure/actions",
    },
  };
  var linkInfo = panelLinks[name];
  if (linkInfo) {
    var link = el("a", "panel-header-link", linkInfo.text);
    link.setAttribute("href", linkInfo.href);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
    link.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    mainRow.insertBefore(link, chevron);
  }

  header.appendChild(mainRow);

  // Summary stats line — panels can set data-summary-text for custom labels
  const summaryText =
    section.getAttribute("data-summary-text") ||
    buildSummaryText(category.summary);
  if (summaryText) {
    header.appendChild(el("div", "panel-header-stats", summaryText));
  }

  // Set up collapsed state
  if (defaultCollapsed) {
    body.classList.add("collapsed");
    body.setAttribute("aria-hidden", "true");
  }

  // Move summary and items into body
  body.appendChild(panelSummary);
  body.appendChild(panelItems);

  // Remove original heading and status container
  h2.remove();
  if (panelStatus) panelStatus.remove();

  // Insert header and body at the top of the section
  const firstChild = section.firstChild;
  section.insertBefore(body, firstChild);
  section.insertBefore(header, body);

  // Toggle handler
  function toggle() {
    const expanded = header.getAttribute("aria-expanded") === "true";
    header.setAttribute("aria-expanded", String(!expanded));
    body.classList.toggle("collapsed");
    body.setAttribute("aria-hidden", String(expanded));
    chevron.textContent = expanded ? "\u25BC" : "\u25B2";
  }

  header.addEventListener("click", toggle);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
}

// ── Panel Rendering ─────────────────────────────────────────────────────────

/**
 * Render all category panels from the report.
 * @param {object} report
 */
function renderPanels(report) {
  const categories = report.categories || {};

  for (const [name, category] of Object.entries(categories)) {
    const section = document.getElementById("panel-" + name);
    if (!section) continue;

    section.classList.add("loaded");
    section.setAttribute("data-category-status", category.status);

    // Status badge in the heading
    const statusContainer = section.querySelector(".panel-status");
    if (statusContainer) {
      statusContainer.textContent = "";
      statusContainer.appendChild(statusBadge(category.status));
    }

    // Delegate to registered renderer or default
    const renderer = panelRenderers[name];
    if (renderer) {
      renderer(section, category);
    } else {
      defaultRenderer(section, category);
    }

    // Set up collapsible card after content is rendered
    setupCollapsible(section, category, name);

    // Add per-panel item filtering
    createItemFilter(section);
  }
}

/**
 * Default renderer: summary stats + flat item list.
 * @param {HTMLElement} section
 * @param {object} category
 */
function defaultRenderer(section, category) {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  renderItemList(itemsEl, category.items);
}

/**
 * Render a flat item list.
 * @param {HTMLElement} container
 * @param {object[]} items
 */
function renderItemList(container, items) {
  if (!items || items.length === 0) {
    container.appendChild(el("p", "no-data-message", "No items to display."));
    return;
  }

  const list = el("ul", "items-list");
  for (const item of items) {
    const li = el("li");
    li.setAttribute("data-item-status", item.status);
    li.appendChild(statusBadge(item.status));
    li.appendChild(el("span", "item-name", shortName(item.name)));
    if (item.message) {
      li.appendChild(el("span", "item-message", item.message));
    }
    list.appendChild(li);
  }
  container.appendChild(list);
}

// ── Error Display ───────────────────────────────────────────────────────────

/**
 * Show a friendly error message in the main content area.
 * @param {string} message
 */
function showError(message) {
  const main = document.getElementById("main");
  if (!main) return;
  main.textContent = "";
  main.appendChild(el("p", "error-message", message));
}

// ── Panel Renderers ─────────────────────────────────────────────────────────

// 1. Tests panel: pass/fail grid + counts
registerPanel("tests", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  const items = category.items || [];
  if (items.length === 0) {
    itemsEl.appendChild(el("p", "no-data-message", "No test results."));
    return;
  }

  // Status grid — each test suite as a small colored cell
  const grid = el("div", "status-grid");
  for (const item of items) {
    const cell = el("div", "status-cell");
    cell.setAttribute("data-status", item.status);
    cell.setAttribute("data-item-status", item.status);
    cell.setAttribute("title", shortName(item.name) + " — " + item.status);
    cell.setAttribute("aria-label", shortName(item.name) + ": " + item.status);
    grid.appendChild(cell);
  }
  itemsEl.appendChild(grid);

  // Expandable list of failing tests
  const failures = items.filter((i) => i.status === "fail");
  if (failures.length > 0) {
    const heading = el("p", undefined, "Failing suites:");
    heading.style.marginTop = "12px";
    heading.style.fontWeight = "600";
    heading.style.fontSize = "0.8125rem";
    itemsEl.appendChild(heading);
    renderItemList(itemsEl, failures);
  }
});

// 2. Lint panel: error/warning counts + expandable file list
registerPanel("lint", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  const items = category.items || [];
  if (items.length === 0) {
    itemsEl.appendChild(el("p", "no-data-message", "No lint results."));
    return;
  }

  for (const item of items) {
    const meta = item.metadata || {};
    const id = "lint-detail-" + item.name.replace(/[^a-zA-Z0-9]/g, "-");

    const toggle = el("button", "expandable-toggle");
    toggle.setAttribute("data-item-status", item.status);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", id);

    const icon = el("span", "expand-icon");
    toggle.appendChild(icon);
    toggle.appendChild(statusBadge(item.status));
    toggle.appendChild(el("span", "item-name", shortName(item.name)));

    // Show lint message (rule descriptions) on the toggle for visibility
    if (item.message) {
      toggle.appendChild(el("span", "item-message", item.message));
    } else if (meta.errors !== undefined || meta.warnings !== undefined) {
      const info =
        (meta.errors || 0) + " errors, " + (meta.warnings || 0) + " warnings";
      toggle.appendChild(el("span", "item-message", info));
    }

    const content = el("div", "expandable-content");
    content.id = id;
    content.hidden = true;

    if (meta.errors !== undefined || meta.warnings !== undefined) {
      const detail =
        (meta.errors || 0) + " errors, " + (meta.warnings || 0) + " warnings";
      content.appendChild(el("p", undefined, detail));
    }
    if (meta.fixable) {
      content.appendChild(el("p", undefined, meta.fixable + " auto-fixable"));
    }

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      content.hidden = expanded;
    });

    itemsEl.appendChild(toggle);
    itemsEl.appendChild(content);
  }
});

// 4. TypeCheck panel: pass/fail with error count
registerPanel("typecheck", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  const items = category.items || [];

  // Clean typecheck: show a clear success message, not zero stats
  if (items.length === 0 && category.status === "pass") {
    summaryEl.appendChild(
      el("p", "no-data-message", "\u2714 All clear \u2014 no type errors")
    );
    // Set custom summary text so the collapsed header shows
    // "All clear" instead of "0 passed / 0 failed"
    section.setAttribute(
      "data-summary-text",
      "\u2714 All clear \u2014 no type errors"
    );
    return;
  }

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  if (items.length > 0) {
    renderItemList(itemsEl, items);
  }
});

// 5. Tokens panel: per-skill usage bars, sorted by severity
registerPanel("tokens", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  const items = category.items || [];
  const summary = category.summary;

  // Token-specific summary with clickable filter boxes
  if (summary) {
    const row = el("div", "stats-row");
    if (summary.failed > 0)
      row.appendChild(filterableStatBox(summary.failed, "Over budget", "fail", itemsEl));
    if (summary.warnings > 0)
      row.appendChild(filterableStatBox(summary.warnings, "Near limit", "warn", itemsEl));
    row.appendChild(filterableStatBox(summary.passed, "Within budget", "pass", itemsEl));
    row.appendChild(statBox(summary.total, "Total"));
    summaryEl.appendChild(row);
  }

  // Set custom summary text for the collapsed panel header
  section.setAttribute(
    "data-summary-text",
    buildTokensSummaryText(summary),
  );

  if (items.length === 0) {
    itemsEl.appendChild(el("p", "no-data-message", "No token data."));
    return;
  }

  // Sort: fail first (over budget), then warn (near limit), then pass (within budget)
  const statusOrder = { fail: 0, warn: 1, pass: 2 };
  const sorted = items.slice().sort(function (a, b) {
    const oa =
      statusOrder[a.status] !== undefined ? statusOrder[a.status] : 3;
    const ob =
      statusOrder[b.status] !== undefined ? statusOrder[b.status] : 3;
    return oa - ob;
  });

  // Show items with status-colored usage bars
  for (const item of sorted) {
    const meta = item.metadata || {};
    if (meta.percentUsed !== undefined) {
      const label = shortName(item.name);
      const pct = Number(meta.percentUsed);
      const bar = tokenBar(label, pct, item.status);

      // Add token count info
      if (meta.tokenCount !== undefined && meta.limit !== undefined) {
        const info = el(
          "span",
          "item-message",
          meta.tokenCount + " / " + meta.limit,
        );
        info.style.marginLeft = "8px";
        bar.appendChild(info);
      }

      itemsEl.appendChild(bar);
      bar.setAttribute("data-item-status", item.status);
    } else {
      // Fallback: flat item
      const row = el("div", "progress-bar-container");
      row.appendChild(statusBadge(item.status));
      row.appendChild(el("span", "item-name", shortName(item.name)));
      if (item.message) {
        row.appendChild(el("span", "item-message", item.message));
      }
      row.setAttribute("data-item-status", item.status);
      itemsEl.appendChild(row);
    }
  }
});

// 6. Frontmatter panel: validation grid
registerPanel("frontmatter", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  const items = category.items || [];
  if (items.length === 0) {
    const msg =
      category.status === "skip"
        ? "Frontmatter validation was skipped."
        : "All frontmatter valid.";
    itemsEl.appendChild(el("p", "no-data-message", msg));
    return;
  }

  // Grid of skill name + badge
  const list = el("ul", "items-list");
  for (const item of items) {
    const li = el("li");
    li.setAttribute("data-item-status", item.status);
    li.appendChild(statusBadge(item.status));
    li.appendChild(el("span", "item-name", shortName(item.name)));
    if (item.message) {
      li.appendChild(el("span", "item-message", item.message));
    }
    list.appendChild(li);
  }
  itemsEl.appendChild(list);
});

// 7. References panel: broken references list
registerPanel("references", (section, category) => {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  if (category.summary) {
    renderFilterableSummaryStats(summaryEl, category.summary, itemsEl);
  }

  const items = category.items || [];
  const broken = items.filter((i) => i.status === "fail");

  if (broken.length === 0) {
    itemsEl.appendChild(el("p", "no-data-message", "All references valid."));
    return;
  }

  const list = el("ul", "items-list");
  for (const item of broken) {
    const li = el("li");
    li.setAttribute("data-item-status", item.status);
    li.appendChild(statusBadge(item.status));

    const nameSpan = el("span", "item-name", shortName(item.name));
    li.appendChild(nameSpan);

    if (item.message) {
      li.appendChild(el("span", "item-message", item.message));
    }
    list.appendChild(li);
  }
  itemsEl.appendChild(list);
});

// ── URL Hash State ───────────────────────────────────────────────────────────

/**
 * Parse URL hash for filter state.
 * @returns {string[]} Active filter statuses from the hash.
 */
function readUrlHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#filter=")) return [];
  const value = hash.slice(8);
  if (!value) return [];
  const valid = new Set(["pass", "fail", "warn", "skip"]);
  return value.split(",").filter((s) => valid.has(s));
}

/**
 * Sync the URL hash with the active global filters.
 */
function syncUrlHash() {
  if (activeGlobalFilters.size === 0) {
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  } else {
    const hash =
      "#filter=" + Array.from(activeGlobalFilters).sort().join(",");
    history.replaceState(null, "", hash);
  }
}

// ── Global Panel Filtering ──────────────────────────────────────────────────

/** Active global filter statuses. Empty means "show all". @type {Set<string>} */
const activeGlobalFilters = new Set();

/**
 * Create a single filter pill button.
 * @param {string} status - Filter status key (all|pass|fail|warn|skip)
 * @param {string} label - Display label
 * @param {number} count - Number of matching items
 * @param {boolean} isActive - Whether the pill starts active
 * @param {function} onClick - Click handler
 * @returns {HTMLElement}
 */
function createFilterPill(status, label, count, isActive, onClick) {
  const pill = el(
    "button",
    "filter-pill" + (isActive ? " filter-pill--active" : ""),
  );
  pill.setAttribute("type", "button");
  pill.setAttribute("aria-pressed", String(isActive));
  pill.setAttribute("data-filter-status", status);
  pill.appendChild(document.createTextNode(label + " "));
  pill.appendChild(el("span", "count", "(" + count + ")"));
  pill.addEventListener("click", onClick);
  return pill;
}

/**
 * Show or hide panel sections based on active global filters.
 */
function applyGlobalFilter() {
  const panels = document.querySelectorAll(".panel[data-category-status]");
  const showAll = activeGlobalFilters.size === 0;
  let visibleCount = 0;

  for (const panel of panels) {
    const status = panel.getAttribute("data-category-status");
    const visible = showAll || activeGlobalFilters.has(status);
    panel.classList.toggle("panel--hidden-by-filter", !visible);
    if (visible) visibleCount++;
  }

  // Show or remove the "no panels match" message
  const grid = document.getElementById("panel-grid");
  let noMsg = grid ? grid.querySelector("[data-filter-empty]") : null;
  if (!showAll && visibleCount === 0) {
    if (!noMsg && grid) {
      noMsg = el(
        "p",
        "no-data-message",
        "No panels match the selected filter.",
      );
      noMsg.setAttribute("data-filter-empty", "true");
      grid.appendChild(noMsg);
    }
  } else if (noMsg) {
    noMsg.remove();
  }

  // Announce to screen readers
  const liveRegion = document.getElementById("live-region");
  if (liveRegion) {
    if (showAll) {
      liveRegion.textContent = "Showing all panels.";
    } else {
      const names = Array.from(activeGlobalFilters).join(", ");
      liveRegion.textContent =
        "Filtered to " + names + ". Showing " + visibleCount + " panels.";
    }
  }
}

// ── Per-Panel Item Filtering ────────────────────────────────────────────────

/**
 * Add a filter bar inside a panel for filtering items by status.
 * Only added when the panel has items with 2+ distinct statuses.
 * @param {HTMLElement} section - The panel section element
 */
function createItemFilter(section) {
  const body = section.querySelector(".panel-body");
  const panelItems = section.querySelector(".panel-items");
  if (!body || !panelItems) return;

  const itemEls = panelItems.querySelectorAll("[data-item-status]");
  if (itemEls.length < 2) return;

  /** @type {Record<string, number>} */
  const statusCounts = {};
  for (const itemEl of itemEls) {
    const s = itemEl.getAttribute("data-item-status") || "";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  if (Object.keys(statusCounts).length < 2) return;

  const bar = el("div", "item-filter-bar");
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Filter items by status");

  for (const status of ["pass", "fail", "warn", "skip"]) {
    if (statusCounts[status]) {
      bar.appendChild(
        createFilterPill(
          status,
          status.toUpperCase(),
          statusCounts[status],
          false,
          () => handleItemFilterClick(section, status, bar),
        ),
      );
    }
  }

  // "Show all" reset button
  const resetBtn = el("button", "item-filter-reset", "Show all");
  resetBtn.setAttribute("type", "button");
  resetBtn.hidden = true;
  resetBtn.addEventListener("click", () => {
    applyItemFilter(section, null);
    for (const p of bar.querySelectorAll(".filter-pill")) {
      p.classList.remove("filter-pill--active");
      p.setAttribute("aria-pressed", "false");
    }
    resetBtn.hidden = true;
  });
  bar.appendChild(resetBtn);

  body.insertBefore(bar, panelItems);
}

/**
 * Handle a click on a per-panel item filter pill.
 * @param {HTMLElement} section
 * @param {string} status
 * @param {HTMLElement} bar
 */
function handleItemFilterClick(section, status, bar) {
  const pill = bar.querySelector('[data-filter-status="' + status + '"]');
  if (!pill) return;

  const wasActive = pill.getAttribute("aria-pressed") === "true";

  // Deactivate all pills
  for (const p of bar.querySelectorAll(".filter-pill")) {
    p.classList.remove("filter-pill--active");
    p.setAttribute("aria-pressed", "false");
  }

  const resetBtn = bar.querySelector(".item-filter-reset");
  if (wasActive) {
    applyItemFilter(section, null);
    if (resetBtn) resetBtn.hidden = true;
  } else {
    pill.classList.add("filter-pill--active");
    pill.setAttribute("aria-pressed", "true");
    applyItemFilter(section, status);
    if (resetBtn) resetBtn.hidden = false;
  }
}

/**
 * Show or hide items within a panel based on their status.
 * @param {HTMLElement} section
 * @param {string|null} status - Status to show, or null to show all.
 */
function applyItemFilter(section, status) {
  const panelItems = section.querySelector(".panel-items");
  if (!panelItems) return;

  const items = panelItems.querySelectorAll("[data-item-status]");
  let visibleCount = 0;

  for (const item of items) {
    const matches =
      !status || item.getAttribute("data-item-status") === status;
    item.classList.toggle("hidden-by-filter", !matches);

    // For expandable toggles, also handle the adjacent content div
    if (item.classList.contains("expandable-toggle")) {
      const next = item.nextElementSibling;
      if (next && next.classList.contains("expandable-content")) {
        next.classList.toggle("hidden-by-filter", !matches);
      }
    }

    if (matches) visibleCount++;
  }

  // Show or remove the "no items match" message
  let noMsg = panelItems.querySelector("[data-filter-empty]");
  if (visibleCount === 0 && status) {
    if (!noMsg) {
      noMsg = el(
        "p",
        "no-data-message",
        "No items match this filter.",
      );
      noMsg.setAttribute("data-filter-empty", "true");
      panelItems.appendChild(noMsg);
    }
  } else if (noMsg) {
    noMsg.remove();
  }
}

// ── Shared Test Results Loader ──────────────────────────────────────────────

/**
 * In-flight promise for the latest test results, shared across both panels
 * so that /api/dates and /api/test-results are only fetched once per page load.
 * @type {Promise<{latestDate: string|null, skillResults: object}> | null}
 */
let _latestTestResultsPromise = null;

/**
 * Returns a memoized promise that resolves to { latestDate, skillResults }.
 * Both panels call this so the network requests are deduplicated.
 * @returns {Promise<{latestDate: string|null, skillResults: object}>}
 */
function fetchLatestTestResults() {
  if (_latestTestResultsPromise) return _latestTestResultsPromise;
  _latestTestResultsPromise = (async () => {
    const datesRes = await fetch("/api/dates");
    if (!datesRes.ok) throw new Error("HTTP " + datesRes.status);
    const dates = await datesRes.json();
    if (!Array.isArray(dates) || dates.length === 0) {
      return { latestDate: null, skillResults: {} };
    }
    const latestDate = dates[0];
    const resultsRes = await fetch(
      "/api/test-results/" + encodeURIComponent(latestDate),
    );
    if (!resultsRes.ok) throw new Error("HTTP " + resultsRes.status);
    const skillResults = await resultsRes.json();
    return { latestDate, skillResults };
  })();
  return _latestTestResultsPromise;
}

// ── Skill Invocation Rates Panel ────────────────────────────────────────────

/**
 * Fetch the latest integration test results and render the skill invocation
 * rate for every prompt on the main dashboard.
 * A prompt is considered passing when its rate is >= SIR_THRESHOLD.
 */
async function loadSkillInvocationRates() {
  const section = document.getElementById("panel-skill-invocation");
  if (!section) return;

  try {
    const { latestDate, skillResults } = await fetchLatestTestResults();

    if (!latestDate) {
      renderSkillInvocationPanel(section, [], "skip", 0, 0, null);
      return;
    }

    // Flatten all test cases that carry a skillInvocationRate
    const prompts = [];
    for (const [skillName, stats] of Object.entries(skillResults)) {
      const allTests = [
        ...(stats.passedTests || []),
        ...(stats.failedTests || []),
      ];
      for (const test of allTests) {
        if (test.skillInvocationRate !== undefined) {
          prompts.push({
            skillName: skillName,
            testName: test.testName,
            rate: test.skillInvocationRate,
          });
        }
      }
    }

    // Sort: below threshold first (worst first), then ascending by rate within each group
    prompts.sort(function (a, b) {
      const aPass = a.rate >= SIR_THRESHOLD;
      const bPass = b.rate >= SIR_THRESHOLD;
      if (aPass !== bPass) return aPass ? 1 : -1;
      return a.rate - b.rate;
    });

    const passing = prompts.filter(function (p) { return p.rate >= SIR_THRESHOLD; }).length;
    const failing = prompts.length - passing;
    const overallStatus =
      prompts.length === 0 ? "skip" : failing > 0 ? "fail" : "pass";

    renderSkillInvocationPanel(
      section, prompts, overallStatus, passing, failing, latestDate,
    );
  } catch {
    renderSkillInvocationPanel(section, [], "skip", 0, 0, null);
  }
}

/**
 * Populate and finalise the skill invocation rates panel.
 * @param {HTMLElement} section
 * @param {Array<{skillName:string, testName:string, rate:number}>} prompts
 * @param {string} overallStatus - pass | fail | skip
 * @param {number} passing
 * @param {number} failing
 * @param {string|null} dateLabel
 */
function renderSkillInvocationPanel(
  section, prompts, overallStatus, passing, failing, dateLabel,
) {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  const total = prompts.length;

  if (total > 0) {
    const row = el("div", "stats-row");
    row.appendChild(statBox(total, "Total"));
    row.appendChild(filterableStatBox(passing, "Above " + SIR_THRESHOLD_PCT + "%", "pass", itemsEl));
    if (failing > 0) {
      row.appendChild(filterableStatBox(failing, "Below " + SIR_THRESHOLD_PCT + "%", "fail", itemsEl));
    }
    summaryEl.appendChild(row);
  }

  if (total === 0) {
    itemsEl.appendChild(
      el("p", "no-data-message", "No skill invocation rate data available."),
    );
  } else {
    const list = el("ul", "items-list");
    for (const prompt of prompts) {
      const status = prompt.rate >= SIR_THRESHOLD ? "pass" : "fail";
      const li = el("li");
      li.setAttribute("data-item-status", status);
      li.appendChild(statusBadge(status));
      li.appendChild(el("span", "item-name", prompt.testName));
      const rateSpan = el("span", "sir-rate");
      rateSpan.setAttribute("data-status", status);
      rateSpan.textContent = (prompt.rate * 100).toFixed(1) + "%";
      li.appendChild(rateSpan);
      list.appendChild(li);
    }
    itemsEl.appendChild(list);
  }

  section.classList.add("loaded");
  section.setAttribute("data-category-status", overallStatus);

  var summaryText =
    total === 0
      ? "No data"
      : passing + " above " + SIR_THRESHOLD_PCT + "%" + (failing > 0 ? " / " + failing + " below " + SIR_THRESHOLD_PCT + "%" : "");
  if (dateLabel) summaryText += " \u2014 " + dateLabel;
  section.setAttribute("data-summary-text", summaryText);

  var fakeCategory = {
    status: overallStatus,
    summary: {
      total: total,
      passed: passing,
      failed: failing,
      warnings: 0,
      skipped: 0,
    },
    items: prompts.map(function (p) {
      return { name: p.testName, status: p.rate >= SIR_THRESHOLD ? "pass" : "fail" };
    }),
  };

  setupCollapsible(section, fakeCategory, "skill-invocation");
  createItemFilter(section);
}

// ── E2E Pass Rate per Skill Panel ───────────────────────────────────────────

/**
 * Fetch the latest integration test results and render the end-to-end pass
 * rate for every skill on the main dashboard.
 * A skill is considered passing when its e2e rate is >= E2E_THRESHOLD.
 */
async function loadE2EPassRates() {
  const section = document.getElementById("panel-e2e-pass-rate");
  if (!section) return;

  try {
    const { latestDate, skillResults } = await fetchLatestTestResults();

    if (!latestDate) {
      renderE2EPassRatePanel(section, [], "skip", 0, 0, null);
      return;
    }

    // Compute e2e pass rate per skill
    const skills = [];
    for (const [skillName, stats] of Object.entries(skillResults)) {
      const total =
        (stats.skillInvocationTestsPassed || 0) +
        (stats.skillInvocationTestsFailed || 0) +
        (stats.otherTestsPassed || 0) +
        (stats.otherTestsFailed || 0);
      if (total === 0) continue;
      const passed =
        (stats.skillInvocationTestsPassed || 0) + (stats.otherTestsPassed || 0);
      skills.push({ skillName, rate: passed / total });
    }

    // Sort: below threshold first (worst first), then ascending within each group
    skills.sort(function (a, b) {
      const aPass = a.rate >= E2E_THRESHOLD;
      const bPass = b.rate >= E2E_THRESHOLD;
      if (aPass !== bPass) return aPass ? 1 : -1;
      return a.rate - b.rate;
    });

    const passing = skills.filter(function (s) { return s.rate >= E2E_THRESHOLD; }).length;
    const failing = skills.length - passing;
    const overallStatus =
      skills.length === 0 ? "skip" : failing > 0 ? "fail" : "pass";

    renderE2EPassRatePanel(
      section, skills, overallStatus, passing, failing, latestDate,
    );
  } catch {
    renderE2EPassRatePanel(section, [], "skip", 0, 0, null);
  }
}

/**
 * Populate and finalise the e2e pass rate panel.
 * @param {HTMLElement} section
 * @param {Array<{skillName:string, rate:number}>} skills
 * @param {string} overallStatus - pass | fail | skip
 * @param {number} passing
 * @param {number} failing
 * @param {string|null} dateLabel
 */
function renderE2EPassRatePanel(
  section, skills, overallStatus, passing, failing, dateLabel,
) {
  const summaryEl = section.querySelector(".panel-summary");
  const itemsEl = section.querySelector(".panel-items");
  if (!summaryEl || !itemsEl) return;

  summaryEl.textContent = "";
  itemsEl.textContent = "";

  const total = skills.length;

  if (total > 0) {
    const row = el("div", "stats-row");
    row.appendChild(statBox(total, "Total"));
    row.appendChild(filterableStatBox(passing, "Above " + E2E_THRESHOLD_PCT + "%", "pass", itemsEl));
    if (failing > 0) {
      row.appendChild(filterableStatBox(failing, "Below " + E2E_THRESHOLD_PCT + "%", "fail", itemsEl));
    }
    summaryEl.appendChild(row);
  }

  if (total === 0) {
    itemsEl.appendChild(
      el("p", "no-data-message", "No end-to-end pass rate data available."),
    );
  } else {
    const list = el("ul", "items-list");
    for (const skill of skills) {
      const status = skill.rate >= E2E_THRESHOLD ? "pass" : "fail";
      const pct = Math.round(skill.rate * 100);
      const li = el("li");
      li.setAttribute("data-item-status", status);

      // Progress bar track — CSS custom property keeps the threshold marker
      // position in sync with the JS threshold constant.
      const barTrack = el("div", "e2e-rate-bar-track");
      barTrack.style.setProperty("--e2e-threshold-pct", String(E2E_THRESHOLD_PCT));

      const barFill = el("div", "e2e-rate-bar-fill");
      barFill.style.width = pct + "%";
      barFill.setAttribute("data-status", status);
      barFill.setAttribute("role", "progressbar");
      barFill.setAttribute("aria-valuemin", "0");
      barFill.setAttribute("aria-valuemax", "100");
      barFill.setAttribute("aria-valuenow", String(pct));
      barFill.setAttribute(
        "aria-label",
        skill.skillName + ": " + pct + "% e2e pass rate (" +
          (status === "pass" ? "above" : "below") + " " + E2E_THRESHOLD_PCT + "% threshold)",
      );

      // Threshold marker — hidden from AT; sr-only sibling communicates the threshold
      const marker = el("div", "e2e-rate-threshold-marker");
      marker.setAttribute("aria-hidden", "true");
      const markerSrText = el("span", "sr-only", E2E_THRESHOLD_PCT + "% pass threshold");
      barTrack.appendChild(barFill);
      barTrack.appendChild(marker);
      barTrack.appendChild(markerSrText);

      li.appendChild(statusBadge(status));
      li.appendChild(el("span", "item-name", skill.skillName));
      li.appendChild(barTrack);
      const rateSpan = el("span", "e2e-rate-value");
      rateSpan.setAttribute("data-status", status);
      rateSpan.textContent = pct + "%";
      li.appendChild(rateSpan);
      list.appendChild(li);
    }
    itemsEl.appendChild(list);
  }

  section.classList.add("loaded");
  section.setAttribute("data-category-status", overallStatus);

  var summaryText =
    total === 0
      ? "No data"
      : passing + " above " + E2E_THRESHOLD_PCT + "%" + (failing > 0 ? " / " + failing + " below " + E2E_THRESHOLD_PCT + "%" : "");
  if (dateLabel) summaryText += " \u2014 " + dateLabel;
  section.setAttribute("data-summary-text", summaryText);

  var fakeCategory = {
    status: overallStatus,
    summary: {
      total: total,
      passed: passing,
      failed: failing,
      warnings: 0,
      skipped: 0,
    },
    items: skills.map(function (s) {
      return { name: s.skillName, status: s.rate >= E2E_THRESHOLD ? "pass" : "fail" };
    }),
  };

  setupCollapsible(section, fakeCategory, "e2e-pass-rate");
  createItemFilter(section);
}

// ── Initialization ──────────────────────────────────────────────────────────

async function init() {
  try {
    const response = await fetch("/api/static");
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    const report = await response.json();

    // Validate schema version
    if (report.schema !== "dashboard-report/v1") {
      showError("Unsupported schema version: " + (report.schema || "unknown"));
      return;
    }

    renderHeader(report);
    renderPanels(report);

    // Restore global filter from URL hash
    var hashFilters = readUrlHash();
    if (hashFilters.length > 0) {
      for (var i = 0; i < hashFilters.length; i++) {
        activeGlobalFilters.add(hashFilters[i]);
      }
      updateHeaderPillStates();
      applyGlobalFilter();
    }

    // ARIA live region announcement
    const liveRegion = document.getElementById("live-region");
    if (liveRegion) {
      const count = Object.keys(report.categories || {}).length;
      liveRegion.textContent =
        "Dashboard loaded with " + count + " categories.";
    }
  } catch {
    showError("No data yet \u2014 run `npm run dashboard:collect` first.");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  init();
  loadSkillInvocationRates();
  loadE2EPassRates();
});
