/* Theme is applied before first paint. Follows OS until an explicit choice is saved. */
window.FinTracker = window.FinTracker || {};
(() => {
  const key = "fintracker.theme",
    media = matchMedia("(prefers-color-scheme: dark)");
  let preference;
  try {
    preference = localStorage.getItem(key);
  } catch {}
  const root = document.documentElement;
  function apply(theme) {
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    document.dispatchEvent(
      new CustomEvent("fintracker:theme", { detail: theme }),
    );
    const button = document.getElementById("theme-toggle");
    if (button) {
      button.setAttribute(
        "aria-label",
        `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
      );
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.innerHTML = `<i class="fas fa-${theme === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`;
    }
    updateCharts();
  }
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  function colorChart(chart) {
    chart.options.animation = matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? false
      : { duration: 220 };
    chart.options.color = token("--text-muted");
    for (const scale of Object.values(chart.options.scales || {})) {
      if (scale.ticks) scale.ticks.color = token("--text-muted");
      if (scale.grid) scale.grid.color = token("--border");
      if (scale.border) scale.border.color = token("--border");
    }
    const tooltip = chart.options.plugins?.tooltip;
    if (tooltip) {
      tooltip.backgroundColor = token("--surface-raised");
      tooltip.titleColor = token("--text");
      tooltip.bodyColor = token("--text-muted");
      tooltip.borderColor = token("--border");
      tooltip.borderWidth = 1;
    }
    if (chart.options.plugins?.legend?.labels)
      chart.options.plugins.legend.labels.color = token("--text-muted");
    if (["doughnut", "pie"].includes(chart.config.type))
      chart.data.datasets.forEach((d) => (d.borderColor = token("--surface")));
    else
      chart.data.datasets.forEach((d) => {
        d.borderColor = token("--accent");
        d.backgroundColor = token("--accent-soft");
      });
  }
  function updateCharts() {
    if (!window.Chart) return;
    Object.values(Chart.instances).forEach((chart) => {
      colorChart(chart);
      chart.update("none");
    });
  }
  FinTracker.theme = {
    get: () => root.dataset.theme,
    set: (theme) => {
      if (!["dark", "light"].includes(theme)) return;
      preference = theme;
      try {
        localStorage.setItem(key, theme);
      } catch {}
      apply(theme);
    },
    token,
    updateCharts,
  };
  FinTracker.charts = {
    create: (context, options) => {
      const canvas = context.canvas || context;
      const old = Chart.getChart(canvas);
      if (old && old.config.type === options.type) {
        old.data = options.data;
        old.options = options.options;
        colorChart(old);
        old.update();
        return old;
      }
      if (old) old.destroy();
      const chart = new Chart(context, options);
      colorChart(chart);
      chart.update("none");
      return chart;
    },
  };
  apply(
    ["dark", "light"].includes(preference)
      ? preference
      : media.matches
        ? "dark"
        : "light",
  );
  media.addEventListener("change", () => {
    if (!["dark", "light"].includes(preference))
      apply(media.matches ? "dark" : "light");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key) {
      preference = event.newValue;
      apply(
        ["dark", "light"].includes(preference)
          ? preference
          : media.matches
            ? "dark"
            : "light",
      );
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    button.id = "theme-toggle";
    button.type = "button";
    button.className = "action-btn theme-toggle";
    button.addEventListener("click", () =>
      FinTracker.theme.set(root.dataset.theme === "dark" ? "light" : "dark"),
    );
    document.querySelector(".quick-actions").prepend(button);
    apply(root.dataset.theme);
  });
})();
