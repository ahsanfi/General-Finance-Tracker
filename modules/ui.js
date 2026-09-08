/* Accessible labels, async feedback and shared component enhancements. */
document.addEventListener("DOMContentLoaded", () => {
  const progress = document.createElement("span");
  progress.className = "api-progress";
  document.querySelector(".app-header").append(progress);
  FinTracker.store.subscribe(
    (state) => (document.body.dataset.busy = String(state.busy > 0)),
  );
  for (const view of document.querySelectorAll(".tab-view"))
    view.setAttribute("aria-label", view.id.replace("view-", ""));
  for (const input of document.querySelectorAll(
    "input[id],select[id],textarea[id]",
  )) {
    if (["file", "hidden"].includes(input.type)) continue;
    if (
      document.querySelector(`label[for="${input.id}"]`) ||
      input.getAttribute("aria-label")
    )
      continue;
    const parent = input.parentElement;
    const label = parent?.querySelector("label:not([for])");
    if (label && parent.querySelectorAll("input,select,textarea").length === 1) {
      label.htmlFor = input.id;
    } else input.setAttribute("aria-label", input.id.replaceAll("-", " "));
  }
  const secret = document.getElementById("config-toko-secret");
  if (secret) {
    secret.type = "password";
    secret.autocomplete = "new-password";
    secret.placeholder = "Saved keys stay private. Enter a replacement.";
  }
  const key = document.getElementById("config-toko-api");
  if (key) key.placeholder = "Enter a new key to replace the saved key";
  // Internal screens keep their interaction hooks while sharing the new component system.
  document
    .querySelectorAll(
      "#view-config .glass-card,#view-daily .glass-card,#view-budget .glass-card",
    )
    .forEach((card) => card.classList.add("internal-surface"));
});
