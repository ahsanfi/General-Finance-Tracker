window.FinTracker = window.FinTracker || {};
(() => {
  let token, expiresAt = 0, signingIn, identityScript;
  const storageKey = "fintracker.google-session";
  const scope = () => JSON.stringify([window.FinTrackerConfig?.googleClientId, window.FinTrackerConfig?.apiUrl]);
  function expiry(credential) {
    try {
      const part = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const value = Number(JSON.parse(atob(part)).exp) * 1000;
      return Number.isFinite(value) ? value : 0;
    } catch (_) { return 0; }
  }
  function restore() {
    try {
      if (sessionStorage.getItem("fintracker.locked") === "true") { clear(); return; }
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return;
      const end = expiry(saved.credential);
      if (saved.scope !== scope() || end <= Date.now() + 60000) { clear(); return; }
      token = saved.credential;
      expiresAt = end;
    } catch (_) { clear(); }
  }
  function loadIdentity() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!identityScript) identityScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = resolve;
      script.onerror = () => { identityScript = null; reject(new Error("Google sign-in could not load. Check your connection and reload.")); };
      document.head.append(script);
    });
    return identityScript;
  }
  function clear() {
    token = null; expiresAt = 0;
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }
  async function credential() {
    if (!token) restore();
    if (token && Date.now() + 60000 < expiresAt) return token;
    clear();
    if (signingIn) return signingIn;
    signingIn = (async () => {
      const clientId = window.FinTrackerConfig?.googleClientId;
      if (!clientId) throw new Error("Set googleClientId in config.js before signing in.");
      const modal = document.getElementById("pin-modal");
      document.getElementById("init-loader")?.classList.add("hidden");
      modal.classList.remove("hidden");
      modal.replaceChildren();
      const card = document.createElement("div");
      card.className = "auth-card";
      const brand = document.createElement("span");
      brand.className = "auth-brand";
      brand.textContent = "FinTracker";
      const title = document.createElement("h2");
      title.textContent = "Welcome back";
      const message = document.createElement("p");
      message.textContent = "Sign in to open your finances.";
      message.setAttribute("role", "status");
      const button = document.createElement("div");
      button.className = "auth-google-button";
      card.append(brand, title, message, button);
      modal.append(card);
      try {
        await loadIdentity();
        return await new Promise(resolve => {
          google.accounts.id.initialize({ client_id: clientId, auto_select: false,
            callback: response => {
              if (!response.credential) return;
              token = response.credential;
              // Expiry is a client-side hint only; the backend verifies every token.
              expiresAt = expiry(token);
              try {
                if (expiresAt > Date.now() + 60000)
                  localStorage.setItem(storageKey, JSON.stringify({ credential: token, scope: scope() }));
              } catch (_) { /* Storage-disabled browsers keep the current in-memory session. */ }
              sessionStorage.removeItem("fintracker.locked");
              modal.classList.add("hidden");
              resolve(token);
            },
          });
          google.accounts.id.renderButton(button, {
            type: "standard", size: "large", shape: "rectangular",
            theme: document.documentElement?.getAttribute("data-theme") === "dark" ? "filled_black" : "outline",
            text: "continue_with", width: Math.min(320, button.clientWidth || 280),
          });
        });
      } catch (error) { message.textContent = error.message; throw error; }
    })().finally(() => { signingIn = null; });
    return signingIn;
  }
  FinTracker.auth = { credential, clear };
})();
