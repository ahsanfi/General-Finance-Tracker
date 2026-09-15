/* Shared runtime: observable state, native RPC, read deduplication and compatibility adapters. */
window.FinTracker = window.FinTracker || {};
(() => {
  const listeners = new Set();
  const state = {
    transactions: [],
    portfolio: [],
    config: {},
    busy: 0,
    error: null,
  };
  const store = {
    get: () => state,
    patch: (update) => {
      Object.assign(state, update);
      listeners.forEach((fn) => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const pending = new Map();
  let bootstrapPromise, initialData, initialBudgets;
  const native = () =>
    !!(window.google?.script?.run || window.FinTrackerPreview);
  async function httpRequest(url, action, payload, credential, read) {
    const timing = { action, requestMs: 0, attempts: [], server: null };
    const started = Date.now();
    const maximumAttempts = read ? 2 : 1;
    try {
      for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
        const controller = new AbortController();
        const entry = { attempt, durationMs: 0, status: null, stage: "connection", outcome: "pending" };
        timing.attempts.push(entry);
        store.patch({ connection: { action, message: attempt === 1 ? "Connecting to your spreadsheet…" : "Retrying connection (2 of 2)…" } });
        const attemptStarted = Date.now();
        let timer, timedOut = false, retryable = false;
        try {
          // Bound both headers and body reads. Saves are never replayed after an uncertain response.
          const exchange = (async () => {
            const response = await fetch(url + "?t=" + Date.now(), {
              method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
              credentials: "omit", redirect: "follow", signal: controller.signal,
              body: JSON.stringify({ ...payload, action, credential }),
            });
            if (timedOut) return;
            entry.status = response.status;
            const redirected = /^https:\/\/script\.googleusercontent\.com\//.test(response.url || "");
            entry.stage = redirected ? "redirected-response" : "endpoint";
            if (!response.ok) {
              retryable = (redirected && response.status === 404) || [429, 500, 502, 503, 504].includes(response.status);
              entry.outcome = "http-error";
              throw new Error(`${redirected ? "Google's redirected response" : "The Apps Script endpoint"} returned HTTP ${response.status}. ${read ? "Could not load data. Try again shortly." : "The save result is unknown. Check your transactions before trying again."}`);
            }
            let result;
            try { result = await response.json(); }
            catch (error) {
              if (timedOut) throw error;
              entry.outcome = "invalid-json";
              throw new Error("The API did not return JSON. Check the /exec URL and deployment settings.");
            }
            return result;
          })();
          const result = await (read ? Promise.race([exchange, new Promise((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              controller.abort();
              reject(new Error("The connection took too long. Your data was not loaded. Try again."));
            }, 12000);
          })]) : exchange);
          entry.outcome = result?.status === "success" ? "success" : "api-error";
          timing.server = result?.timing || null;
          return result;
        } catch (error) {
          if (read && entry.status === 404 && entry.stage === "redirected-response" && FinTracker.readBridge) {
            clearTimeout(timer);
            entry.durationMs = Date.now() - attemptStarted;
            const recovery = { attempt: attempt + 1, stage: "html-recovery", outcome: "pending", durationMs: 0 };
            timing.attempts.push(recovery);
            const recoveryStarted = Date.now();
            store.patch({ connection: { action, message: "Trying an alternative connection…" } });
            try {
              const result = await FinTracker.readBridge(url, {...payload, action, credential});
              recovery.outcome = result?.status === "success" ? "success" : "api-error";
              timing.server = result?.timing || null;
              return result;
            } catch (failure) {
              recovery.outcome = "failed";
              throw failure;
            } finally {
              recovery.durationMs = Date.now() - recoveryStarted;
            }
          }
          if (timedOut) { entry.outcome = "timeout"; retryable = true; }
          else if (entry.outcome === "pending") {
            entry.outcome = "network-error";
            retryable = true;
            error = new Error(read ? "Connection interrupted. Try again to load your data." : "Connection interrupted. Verify the result before retrying a save.");
          }
          if (!read || !retryable || attempt === maximumAttempts) throw error;
        } finally {
          clearTimeout(timer);
          if (!entry.durationMs) entry.durationMs = Date.now() - attemptStarted;
        }
        // Retry from /exec to obtain a fresh redirect, never reuse its one-time URL.
        store.patch({ connection: { action, message: "Connection interrupted. Retrying…" } });
        await new Promise(resolve => setTimeout(resolve, 750));
      }
    } finally {
      timing.requestMs = Date.now() - started;
      FinTracker.api.lastTiming = timing;
      if (state.connection?.action === action) store.patch({ connection: null });
    }
  }
  async function request(action, payload = {}) {
    const read = [
      "getBootstrap",
      "getData",
      "getSystemConfig",
      "getBudgets",
      "getPortfolio",
    ].includes(action);
    const key = action + JSON.stringify(payload);
    if (read && pending.has(key)) return pending.get(key);
    const operation = (async () => {
      store.patch({ busy: state.busy + 1, error: null });
      try {
        let result;
        if (window.FinTrackerPreview)
          result = await window.FinTrackerPreview.request({
            action,
            ...payload,
          });
        else if (window.google?.script?.run)
          result = await new Promise((resolve, reject) =>
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(() =>
                reject(
                  new Error(
                    "Connection interrupted. Refresh to verify the result before retrying.",
                  ),
                ),
              )
              .financeApi({ action, ...payload }),
          );
        else {
          let url = window.FinTrackerConfig?.apiUrl || "";
          if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))
            throw new Error("Set your Apps Script deployment /exec URL in config.js.");
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocal) url = '/proxy/' + url;
          const credential = await FinTracker.auth.credential();
          result = await httpRequest(url, action, payload, credential, read);
          if (result?.code === "AUTH_REQUIRED") FinTracker.auth.clear();
        }
        if (!result || result.status !== "success")
          throw new Error(
            result?.message || "The server returned an invalid response.",
          );
        if (result.session) FinTracker.auth?.acceptSession?.(result.session);
        if (!read) {
          initialData = null;
          initialBudgets = null;
        }
        return result;
      } catch (error) {
        store.patch({ error: error.message });
        throw error;
      } finally {
        store.patch({ busy: Math.max(0, state.busy - 1) });
      }
    })();
    if (read) {
      pending.set(key, operation);
      operation.finally(() => pending.delete(key)).catch(() => {});
    }
    return operation;
  }
  async function bootstrap() {
    if (!bootstrapPromise)
      bootstrapPromise = request("getBootstrap")
        .then((result) => {
          initialData = { status: "success", ...result.data };
          initialBudgets = { status: "success", budgets: result.budgets };
          store.patch({ config: result.config });
          return {
            status: "success",
            ...result.config,
            authenticated: true,
            email: result.email,
          };
        })
        .catch((error) => {
          bootstrapPromise = null;
          throw error;
        });
    return bootstrapPromise;
  }
  async function compatibilityFetch(_url, options) {
    const { action, ...payload } = JSON.parse(options.body);
    let result;
    if (action === "getSystemConfig") result = await bootstrap();
    else if (action === "getData" && initialData) {
      result = initialData;
      initialData = null;
    } else if (action === "getBudgets" && initialBudgets) {
      result = initialBudgets;
      initialBudgets = null;
    } else result = await request(action, payload);
    return { ok: true, json: async () => result };
  }
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  Object.assign(FinTracker, {
    store,
    api: { request, bootstrap, fetch: compatibilityFetch, isNative: native },
    escape,
  });
})();
