/* Progressive workspace tools. Existing controllers remain the source of ledger writes. */
document.addEventListener("DOMContentLoaded", () => {
  const { store, insights, api } = FinTracker;
  const $ = (id) => document.getElementById(id);
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const money = (value) =>
    window.isBalancesHidden
      ? "••••"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(value);
  const available = () => !$("main-content").classList.contains("hidden");
  const dialog = (id, title, content) => {
    const el = node("dialog", "workspace-dialog");
    el.id = id;
    el.setAttribute("aria-labelledby", id + "-title");
    const heading = node("div", "dialog-heading"),
      label = node("h2", "", title),
      close = node("button", "dialog-close", "×");
    label.id = id + "-title";
    close.type = "button";
    close.setAttribute("aria-label", "Close " + title);
    close.onclick = () => el.close();
    heading.append(label, close);
    el.append(heading, content);
    document.body.append(el);
    el.addEventListener("click", (event) => {
      if (event.target === el) {
        const r = el.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          el.close();
      }
    });
    return el;
  };
  const outlook = node("section", "insight-workbench");
  outlook.id = "financial-outlook";
  outlook.setAttribute("aria-label", "Cash flow outlook and scenario planner");
  outlook.innerHTML = `<div class="outlook-main"><div class="outlook-heading"><h3>Your month, ahead.</h3><span id="outlook-month" class="outlook-month"></span></div><dl class="outlook-metrics"><div><dt>Daily burn rate</dt><dd id="burn-rate">Calculating</dd></div><div><dt>Projected month-end cash</dt><dd id="projected-balance" class="projected">Calculating</dd></div></dl><p id="outlook-basis" class="outlook-note"></p><p id="workspace-status" class="workspace-status" role="status"></p></div><div class="scenario-panel"><h4>What if you changed the pace?</h4><label for="scenario-reduction">Reduce remaining spending by <output id="reduction-label">0%</output></label><input id="scenario-reduction" type="range" min="0" max="100" step="5" value="0"><label for="scenario-incoming">Expected additional income · IDR</label><input id="scenario-incoming" type="number" min="0" max="1000000000000" step="1000" value="0"><div class="scenario-result"><span>Scenario month-end cash</span><strong id="scenario-balance"></strong></div><p class="outlook-note">Explore an estimate. This does not create transactions.</p></div>`;
  document.querySelector(".summary-layout").after(outlook);
  let frame;
  function renderOutlook() {
    const state = store.get();
    const model = insights.project(
      state.transactions,
      state.config.investmentAccounts,
      state.rate || 16000,
      new Date(),
      $("scenario-reduction").value,
      $("scenario-incoming").value,
    );
    $("outlook-month").textContent = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(new Date());
    $("burn-rate").textContent = model.hasHistory
      ? money(model.burn)
      : "No spending yet";
    $("projected-balance").textContent = model.hasHistory
      ? money(model.baseline)
      : "Needs spending history";
    $("scenario-balance").textContent = model.hasHistory
      ? money(model.projected)
      : "Not enough history";
    $("reduction-label").textContent = $("scenario-reduction").value + "%";
    $("outlook-basis").textContent = model.hasHistory
      ? `${model.entries} recorded expenses across ${model.elapsed} calendar days; ${model.remaining} days remain. Current cash less spending at this month's daily pace. Excludes investment accounts and future income. USD uses your current rate. Estimates depend on complete records.`
      : "Record everyday expenses to estimate your spending pace. Transfers and investment-account activity are excluded. Future-dated entries are not counted.";
    $("workspace-status").textContent = state.busy
      ? "Updating your workspace…"
      : state.error
        ? `Update failed: ${state.error}`
        : "Based on your recorded transactions. No automatic financial actions.";
    outlook.setAttribute("aria-busy", String(state.busy > 0));
  }
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(renderOutlook);
  };
  store.subscribe(schedule);
  $("scenario-reduction").oninput = schedule;
  $("scenario-incoming").oninput = schedule;
  renderOutlook();

  // Quick capture has its own draft, leaving the full transaction editor untouched.
  const quickForm = node("form", "quick-form");
  quickForm.id = "quick-add-form";
  quickForm.innerHTML = `<div class="field-row"><div class="field"><label for="quick-type">Type</label><select id="quick-type"><option value="expense">Expense</option><option value="income">Income</option></select></div><div class="field"><label for="quick-currency">Currency</label><select id="quick-currency"><option>IDR</option><option>USD</option></select></div></div><div class="field"><label for="quick-amount">Amount</label><input id="quick-amount" inputmode="decimal" placeholder="0 or 25 + 15" required maxlength="200"></div><div class="field"><label for="quick-note">Description</label><input id="quick-note" placeholder="What was this for?" required maxlength="500"></div><div class="field-row"><div class="field"><label for="quick-account">Account</label><select id="quick-account" required></select></div><div class="field"><label for="quick-category">Category</label><select id="quick-category" required></select></div></div><div class="field"><label for="quick-date">Date</label><input id="quick-date" type="date" required></div><p id="quick-feedback" class="workspace-feedback" role="status"></p><button id="quick-save" class="primary-button" type="submit">Save transaction</button><button id="quick-transfer" class="text-button" type="button">Open transfer form</button>`;
  const quick = dialog("quick-add-dialog", "Quick add", quickForm);
  function options(id, values) {
    const select = $(id),
      previous = select.value;
    select.replaceChildren(
      ...values.map((value) => {
        const option = node("option", "", value);
        option.value = value;
        return option;
      }),
    );
    if (values.includes(previous)) select.value = previous;
  }
  function quickOptions() {
    const config = store.get().config;
    options(
      "quick-account",
      config[
        $("quick-currency").value === "USD" ? "walletsUSD" : "walletsIDR"
      ] || [],
    );
    options(
      "quick-category",
      config[$("quick-type").value === "income" ? "inc" : "exp"] || ["General"],
    );
  }
  $("quick-type").onchange = quickOptions;
  $("quick-currency").onchange = quickOptions;
  let saving = false;
  function openQuick(type) {
    if (!available()) return;
    if (type) $("quick-type").value = type;
    quickOptions();
    if (!$("quick-date").value)
      $("quick-date").value = insights.dateKey(new Date());
    quick.showModal();
    $("quick-amount").focus();
  }
  quick.addEventListener("cancel", (event) => {
    if (saving) event.preventDefault();
  });
  $("quick-transfer").onclick = () => {
    quick.close();
    window.switchTab("view-add");
    $("entry-type-transfer").click();
    $("entry-amt-source").focus();
  };
  quickForm.onsubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const amount = FinTracker.domain.calculate(
      $("quick-amount").value.replace(/,/g, ""),
    );
    if (!amount) {
      $("quick-feedback").textContent =
        "Enter a positive amount or a valid calculation.";
      return;
    }
    saving = true;
    $("quick-save").disabled = true;
    $("quick-save").textContent = "Saving…";
    $("quick-feedback").textContent = "";
    const controls = [...quickForm.querySelectorAll("input,select")];
    controls.forEach((el) => (el.disabled = true));
    try {
      await api.request("add", {
        sheetName: $("quick-type").value === "income" ? "Income" : "Expenses",
        date: $("quick-date").value,
        description: $("quick-note").value.trim(),
        amount,
        currency: $("quick-currency").value,
        account: $("quick-account").value,
        category: $("quick-category").value,
      });
      $("quick-amount").value = "";
      $("quick-note").value = "";
      $("quick-feedback").textContent = "Transaction saved.";
      await window.refreshFinTracker();
      quick.close();
    } catch (error) {
      $("quick-feedback").textContent = error.message;
    } finally {
      saving = false;
      controls.forEach((el) => (el.disabled = false));
      $("quick-save").disabled = false;
      $("quick-save").textContent = "Save transaction";
    }
  };
  const floating = node("button", "quick-add-launch", "＋ Quick add");
  floating.id = "quick-add-launch";
  floating.type = "button";
  floating.setAttribute("aria-haspopup", "dialog");
  floating.onclick = () => openQuick();
  $("main-content").append(floating);

  // Command searches reuse the existing ledger filters.
  const filterIds = [
    "filter-search",
    "filter-start",
    "filter-end",
    "filter-cat",
    "filter-acc",
  ];
  function applyFilters(filters) {
    window.switchTab("view-transactions");
    for (const id of filterIds) {
      const value = filters[id];
      $(id).value =
        typeof value === "string"
          ? value
          : id === "filter-cat" || id === "filter-acc"
            ? "all"
            : "";
      if ($(id).tagName === "SELECT" && !$(id).value) $(id).value = "all";
    }
    $("filter-search").dispatchEvent(new Event("input", { bubbles: true }));
  }

  const commandContent = node("div", "");
  commandContent.innerHTML =
    '<div class="command-field"><label for="command-input" class="sr-only">Search actions and transaction history</label><input id="command-input" placeholder="Search actions or your history…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="command-results" aria-autocomplete="list"></div><div id="command-results" class="command-results" role="listbox" aria-label="Actions and transactions"></div><p id="command-count" class="command-footer" role="status"></p>';
  const palette = dialog(
    "command-palette",
    "Find your next move",
    commandContent,
  );
  const launch = node("button", "command-launch");
  launch.id = "command-launch";
  launch.type = "button";
  launch.innerHTML =
    '<span aria-hidden="true">⌕</span><span class="command-label">Search & actions</span><kbd>⌘ / Ctrl K</kbd>';
  launch.setAttribute("aria-label", "Open command palette");
  launch.setAttribute("aria-haspopup", "dialog");
  document.querySelector(".quick-actions").prepend(launch);
  let results = [],
    active = 0;
  const navigate = (label, target) => ({
    label,
    detail: "Navigation",
    run: () => {
      const control =
        target === "view-config"
          ? $("config-btn")
          : document.querySelector(`.desk-nav-btn[data-target="${target}"]`);
      if (control) control.click();
      else window.switchTab(target);
    },
  });
  function searchHistory(text) {
    applyFilters({ "filter-search": text });
    $("filter-search").focus();
  }
  function commands() {
    return [
      {
        label: "Add expense",
        detail: "Quick capture",
        run: () => openQuick("expense"),
      },
      {
        label: "Add income",
        detail: "Quick capture",
        run: () => openQuick("income"),
      },
      {
        label: "Transfer money",
        detail: "Between wallets",
        run: () => {
          $("quick-transfer").click();
        },
      },
      navigate("Dashboard", "view-dashboard"),
      navigate("Transaction history", "view-transactions"),
      navigate("Settings & access", "view-config"),
      navigate("Budgets", "view-budget"),
      navigate("Calendar", "view-daily"),
      {
        label: "Export monthly analytics for AI",
        detail: "Investment and net-worth review",
        run: () => FinTracker.aiExport.open(),
      },
      {
        label: "Finance assistant",
        detail: "Ask about your finances",
        run: () => $("ai-chat-btn").click(),
      },
      {
        label: "Export CSV",
        detail: "Download transaction history",
        run: () => $("export-csv-btn").click(),
      },
      {
        label: "Export image",
        detail: "Save your finance snapshot",
        run: () => $("export-btn").click(),
      },
      {
        label: "Lock workspace",
        detail: "End this workspace session",
        run: () => $("logout-btn").click(),
      },
      {
        label: "Portfolio & investments",
        detail: "Assets and performance",
        run: () => {
          window.switchTab("view-budget");
          $("subtab-investments-btn").click();
        },
      },
      {
        label: "Toggle light / dark theme",
        detail: "Appearance",
        run: () =>
          FinTracker.theme.set(
            FinTracker.theme.get() === "dark" ? "light" : "dark",
          ),
      },
    ];
  }
  function select(index) {
    active = index;
    [...$("command-results").children].forEach((el, i) =>
      el.setAttribute("aria-selected", String(i === active)),
    );
    const item = $("command-results").children[active];
    if (item) {
      $("command-input").setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    } else $("command-input").removeAttribute("aria-activedescendant");
  }
  function execute(index) {
    const result = results[index];
    if (!result) return;
    palette.close();
    document.querySelectorAll('[id$="-modal"]').forEach((el) => {
      if (el.tagName !== "DIALOG" && el.id !== "pin-modal")
        el.classList.add("hidden");
    });
    result.run();
  }
  function renderCommands() {
    const query = $("command-input").value.trim().toLowerCase();
    results = commands().filter((c) =>
      (c.label + " " + c.detail).toLowerCase().includes(query),
    );
    if (query) {
      const matches = store
        .get()
        .transactions.filter((t) =>
          [t.desc, t.cat, t.acc, t.date].some((v) =>
            String(v).toLowerCase().includes(query),
          ),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      results.push(
        ...matches.slice(0, 30).map((t) => ({
          label: t.desc,
          detail: `${t.date} · ${t.acc} · ${t.cat}`,
          run: () => {
            applyFilters({
              "filter-search": t.desc,
              "filter-start": t.date,
              "filter-end": t.date,
              "filter-acc": t.acc,
              "filter-cat": t.cat,
            });
          },
        })),
      );
      results.push({
        label: `Search history for “${$("command-input").value.trim()}”`,
        detail: "Open filtered ledger",
        run: () => searchHistory($("command-input").value.trim()),
      });
    }
    const fragment = document.createDocumentFragment();
    results.forEach((result, index) => {
      const item = node("div", "command-result");
      item.id = "command-result-" + index;
      item.setAttribute("role", "option");
      const label = node("div", "", result.label);
      label.append(node("small", "", result.detail));
      item.append(label);
      item.onclick = () => execute(index);
      fragment.append(item);
    });
    $("command-results").replaceChildren(fragment);
    select(0);
    $("command-count").textContent =
      `${results.length} results · ↑ ↓ to navigate · Enter to open · Esc to close. History limited to 30 matches.`;
  }
  function openPalette() {
    if (!available()) return;
    const current = document.querySelector("dialog[open]");
    if (current && current !== palette) {
      if (saving) return;
      current.close();
    }
    palette.showModal();
    $("command-input").value = "";
    renderCommands();
    $("command-input").focus();
  }
  launch.onclick = openPalette;
  $("command-input").oninput = renderCommands;
  $("command-input").onkeydown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter") execute(active);
      else if (results.length)
        select(
          (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) %
            results.length,
        );
    }
  };
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette.open) palette.close();
      else openPalette();
    }
  });
  FinTracker.workspace = { openPalette, openQuick };
});
