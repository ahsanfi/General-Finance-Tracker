/* Phone ergonomics: move existing nodes, preserve drafts and delegate all ledger actions. */
document.addEventListener("DOMContentLoaded", () => {
  const phone = matchMedia("(max-width: 768px)"),
    root = document.documentElement;
  FinTracker.confirm = (message) => {
    if (!phone.matches) return Promise.resolve(window.confirm(message));
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "workspace-dialog";
      dialog.setAttribute("aria-label", "Confirm action");
      const content = document.createElement("div");
      content.className = "quick-form";
      const text = document.createElement("p");
      text.textContent = message;
      text.style.whiteSpace = "pre-line";
      text.style.marginBottom = "20px";
      const yes = document.createElement("button");
      yes.className = "primary-button";
      yes.textContent = "Continue";
      const no = document.createElement("button");
      no.className = "secondary-button";
      no.textContent = "Cancel";
      yes.onclick = () => dialog.close("yes");
      no.onclick = () => dialog.close("no");
      content.append(text, yes, no);
      dialog.append(content);
      document.body.append(dialog);
      dialog.addEventListener(
        "close",
        () => {
          const accepted = dialog.returnValue === "yes";
          dialog.remove();
          resolve(accepted);
        },
        { once: true },
      );
      dialog.showModal();
      no.focus();
    });
  };
  const entry = document.getElementById("view-add"),
    anchor = document.createComment("Full transaction editor");
  entry.before(anchor);
  const sheet = document.createElement("dialog");
  sheet.id = "mobile-entry-sheet";
  sheet.className = "workspace-dialog";
  sheet.setAttribute("aria-label", "Transaction editor");
  const heading = document.createElement("div");
  heading.className = "dialog-heading";
  const title = document.createElement("h2");
  title.textContent = "Transaction";
  const close = document.createElement("button");
  close.className = "dialog-close mobile-entry-close";
  close.type = "button";
  close.textContent = "Close";
  close.setAttribute("aria-label", "Close transaction editor");
  close.onclick = () => sheet.close();
  heading.append(title, close);
  sheet.append(heading);
  document.body.append(sheet);
  let previous = "view-dashboard";
  let resizeClosures = 0;
  function syncEntry() {
    if (!phone.matches) return;
    if (!entry.classList.contains("hidden")) {
      if (!sheet.open) sheet.showModal();
    } else if (sheet.open) sheet.close();
  }
  sheet.addEventListener("close", () => {
    if (resizeClosures) {
      resizeClosures--;
      return;
    }
    if (phone.matches && !sheet.open && !entry.classList.contains("hidden"))
      window.switchTab(previous);
  });
  document.querySelectorAll(".tab-view").forEach((view) =>
    new MutationObserver(() => {
      if (view !== entry && !view.classList.contains("hidden"))
        previous = view.id;
      syncEntry();
    }).observe(view, { attributes: true, attributeFilter: ["class"] }),
  );
  const nav = document.getElementById("mobile-nav"),
    command = document.createElement("button");
  command.className = "mobile-command-tab";
  command.type = "button";
  command.setAttribute("aria-label", "Search actions and settings");
  command.setAttribute("aria-haspopup", "dialog");
  command.innerHTML =
    '<i class="fas fa-ellipsis-h" aria-hidden="true"></i><span>More</span>';
  command.onclick = () => FinTracker.workspace.openPalette();
  nav.firstElementChild.append(command);
  nav.querySelector('[data-target="view-transactions"] span').textContent =
    "History";
  const scenario = document.querySelector(".scenario-panel"),
    scenarioDetails = document.createElement("details"),
    scenarioSummary = document.createElement("summary");
  scenarioDetails.className = "phone-scenario";
  scenarioSummary.textContent = "Explore a spending scenario";
  scenario.before(scenarioDetails);
  scenarioDetails.append(scenarioSummary, scenario);
  const basis = document.getElementById("outlook-basis"),
    explanation = document.createElement("details"),
    explanationTitle = document.createElement("summary");
  explanation.className = "phone-method";
  explanationTitle.textContent = "How this estimate works";
  basis.before(explanation);
  explanation.append(
    explanationTitle,
    basis,
    document.getElementById("workspace-status"),
  );
  function viewport() {
    const v = window.visualViewport;
    root.style.setProperty("--phone-height", `${v ? v.height : innerHeight}px`);
    root.style.setProperty(
      "--keyboard-offset",
      phone.matches && v && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && document.activeElement?.inputMode !== "none"
        ? `${Math.max(0, innerHeight - v.height - v.offsetTop)}px`
        : "0px",
    );
  }
  function adapt() {
    scenarioDetails.open = !phone.matches;
    explanation.open = !phone.matches;
    if (phone.matches) {
      sheet.append(entry);
      syncEntry();
    } else {
      if (sheet.open) {
        resizeClosures++;
        sheet.close();
      }
      anchor.after(entry);
    }
    viewport();
  }
  phone.addEventListener("change", adapt);
  document.addEventListener("focusin", viewport);
  document.addEventListener("focusout", () => requestAnimationFrame(viewport));
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const zoomPolicy = () => {
    viewportMeta.content = "width=device-width, initial-scale=1.0, viewport-fit=cover" + (phone.matches ? ", maximum-scale=1, user-scalable=no" : "");
    root.classList.toggle("phone-no-zoom", phone.matches);
  };
  phone.addEventListener("change", zoomPolicy);
  zoomPolicy();
  document.addEventListener("gesturestart", event => { if (phone.matches) event.preventDefault(); }, {passive:false});
  window.visualViewport?.addEventListener("resize", viewport);
  window.visualViewport?.addEventListener("scroll", viewport);
  window.addEventListener("resize", viewport);
  adapt();

  const list = document.getElementById("mobile-trans-list"),
    hint = document.createElement("p");
  hint.className = "swipe-hint";
  hint.textContent =
    "Swipe right to edit, left to review deletion. Buttons work too.";
  list.before(hint);
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  list.after(status);
  function decorate() {
    for (const row of [...list.children]) {
      if (
        !row.querySelector(".edit-btn") ||
        row.classList.contains("mobile-swipe-track")
      )
        continue;
      const track = document.createElement("div");
      track.className = "mobile-swipe-track";
      row.before(track);
      track.append(row);
      row
        .querySelector(".edit-btn")
        .setAttribute("aria-label", "Edit transaction");
      row
        .querySelector(".del-btn")
        .setAttribute("aria-label", "Delete transaction");
    }
  }
  new MutationObserver(decorate).observe(list, { childList: true });
  decorate();
  let gesture = null;
  function reset() {
    if (!gesture) return;
    gesture.row.style.removeProperty("transform");
    gesture.track.classList.remove("is-swiping");
    gesture.track.removeAttribute("data-direction");
    gesture.track.style.removeProperty("--swipe-x");
    gesture = null;
  }
  list.addEventListener("pointerdown", (event) => {
    if (
      !phone.matches ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.target.closest("button,a,input,select")
    )
      return;
    const track = event.target.closest(".mobile-swipe-track");
    if (!track) return;
    reset();
    gesture = {
      track,
      row: track.firstElementChild,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      delta: 0,
      locked: false,
    };
  });
  list.addEventListener("pointermove", (event) => {
    const g = gesture;
    if (!g || event.pointerId !== g.id) return;
    const dx = event.clientX - g.x,
      dy = event.clientY - g.y;
    if (!g.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        reset();
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      g.locked = true;
      g.row.setPointerCapture(event.pointerId);
      g.track.classList.add("is-swiping");
    }
    g.delta = Math.max(-100, Math.min(100, dx));
    g.track.dataset.direction = dx > 0 ? "right" : "left";
    g.track.style.setProperty("--swipe-x", `${g.delta}px`);
    g.row.style.transform = `translateX(${g.delta}px)`;
  });
  list.addEventListener("pointerup", (event) => {
    const g = gesture;
    if (!g || event.pointerId !== g.id) return;
    const action =
      g.locked && Math.abs(g.delta) >= 72
        ? g.row.querySelector(g.delta > 0 ? ".edit-btn" : ".del-btn")
        : null;
    reset();
    if (action) {
      status.textContent = action.classList.contains("edit-btn")
        ? "Opening transaction editor."
        : "Review deletion before confirming.";
      action.click();
    }
  });
  list.addEventListener("pointercancel", reset);
  phone.addEventListener("change", reset);
});
