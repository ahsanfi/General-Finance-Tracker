/* Step 1: presentation only. No requests, storage, business calculations or RPC overrides. */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const main = document.getElementById("main-content");
  if (!main) return;
  const header = main.querySelector(".app-header");
  if (!header) return;
  const originalNavigation = header.querySelector(".desktop-nav");
  if (!main || !header || !originalNavigation) return;
  const create = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const icon = (name) => {
    const el = create("i", `fas fa-${name}`);
    el.setAttribute("aria-hidden", "true");
    return el;
  };
  document.body.classList.add("modern-shell");
  const sidebar = create("aside", "shell-sidebar");
  sidebar.setAttribute("aria-label", "Workspace");
  const brand = create("div", "shell-brand");
  const mark = create("span", "shell-brand-mark");
  mark.append(icon("wallet"));
  const name = create("div", "", "FinTracker");
  name.append(create("small", "", "YOUR PERSONAL FINANCE WORKSPACE"));
  brand.append(mark, name);
  sidebar.append(brand, create("p", "shell-nav-label", "WORKSPACE"));
  originalNavigation.setAttribute("aria-label", "Main navigation");
  const navigationIcons = [
    "chart-pie",
    "list-ul",
    "plus",
    "calendar-days",
    "layer-group",
  ];
  originalNavigation.querySelectorAll("button").forEach((button, index) => {
    button.prepend(icon(navigationIcons[index]));
    button.type = "button";
  });
  // Move the original nodes, preserving IDs, attached listeners and budget loading hooks.
  sidebar.append(originalNavigation);
  const settings = create("button", "shell-settings", "Settings & access");
  settings.type = "button";
  settings.prepend(icon("sliders-h"));
  settings.addEventListener("click", () =>
    document.getElementById("config-btn").click(),
  );
  sidebar.append(settings);
  const bottom = create("div", "shell-sidebar-bottom");
  bottom.append(
    create("span", "shell-status-dot"),
    create("span", "", "Personal finance workspace"),
  );
  bottom.append(create("small", "", "Track · Plan · Invest"));
  sidebar.append(bottom);
  main.prepend(sidebar);
  const breadcrumb = create(
    "span",
    "shell-breadcrumb",
    "Workspace / Dashboard",
  );
  breadcrumb.setAttribute("aria-live", "polite");
  header.querySelector(".app-title").after(breadcrumb);
  header.querySelectorAll(".quick-actions button").forEach((button) => {
    button.type = "button";
    if (!button.hasAttribute("aria-label"))
      button.setAttribute("aria-label", button.title || "Workspace action");
  });
  const views = [...document.querySelectorAll(".tab-view")];
  const titles = {
    "view-dashboard": "Dashboard",
    "view-transactions": "Transactions",
    "view-add": "Add / Transfer",
    "view-daily": "Daily & Calendar",
    "view-budget": "Plan & Invest",
    "view-config": "Settings & access",
  };
  const syncNavigation = () => {
    const active = views.find((view) => !view.classList.contains("hidden"));
    if (!active) return;
    breadcrumb.textContent = "Workspace / " + (titles[active.id] || "Overview");
    originalNavigation.querySelectorAll("button").forEach((button) => {
      if (button.dataset.target === active.id)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (active.id === "view-config")
      settings.setAttribute("aria-current", "page");
    else settings.removeAttribute("aria-current");
  };
  const observer = new MutationObserver(syncNavigation);
  views.forEach((view) =>
    observer.observe(view, { attributes: true, attributeFilter: ["class"] }),
  );
  syncNavigation();
});
