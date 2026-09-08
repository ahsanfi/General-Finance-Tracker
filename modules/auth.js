window.FinTracker = window.FinTracker || {};
(() => {
  let token, expiresAt = 0, signingIn, identityScript;
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
  function clear() { token = null; expiresAt = 0; }
  async function credential() {
    if (token && Date.now() < expiresAt) return token;
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
      const title = document.createElement("h2");
      title.textContent = "Sign in to FinTracker";
      const message = document.createElement("p");
      message.textContent = "Use an account approved by the workspace owner.";
      message.setAttribute("role", "status");
      const button = document.createElement("div");
      card.append(title, message, button);
      modal.append(card);
      try {
        await loadIdentity();
        return await new Promise(resolve => {
          google.accounts.id.initialize({ client_id: clientId, auto_select: false,
            callback: response => {
              if (!response.credential) return;
              token = response.credential;
              // Server checks the actual expiry and identity; this is only a renewal timer.
              expiresAt = Date.now() + 45 * 60 * 1000;
              sessionStorage.removeItem("fintracker.locked");
              modal.classList.add("hidden");
              resolve(token);
            },
          });
          google.accounts.id.renderButton(button, { type: "standard", size: "large", theme: "outline", text: "signin_with" });
        });
      } catch (error) { message.textContent = error.message; throw error; }
    })().finally(() => { signingIn = null; });
    return signingIn;
  }
  FinTracker.auth = { credential, clear };
})();
