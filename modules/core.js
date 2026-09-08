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
          const url = window.FinTrackerConfig?.apiUrl || "";
          if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))
            throw new Error("Set your Apps Script deployment /exec URL in config.js.");
          const credential = await FinTracker.auth.credential();
          let response;
          try {
            response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              credentials: "omit",
              redirect: "follow",
              body: JSON.stringify({ ...payload, action, credential }),
            });
          } catch (_) {
            throw new Error("Connection interrupted. Verify the result before retrying a save. Check the Apps Script deployment allows Anyone access.");
          }
          if (!response.ok) throw new Error("The Apps Script API is unavailable. Check its deployment settings.");
          try { result = await response.json(); }
          catch (_) { throw new Error("The API did not return JSON. Check the /exec URL and deploy the updated code.gs as Me, with Anyone access."); }
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
