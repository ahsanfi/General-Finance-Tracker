/* Recorded cash flows only. The projection is an estimate, never a scheduled payment. */
(function (root) {
  const dateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function project(
    transactions,
    investmentAccounts = [],
    rate = 16000,
    now = new Date(),
    reduction = 0,
    incoming = 0,
  ) {
    const today = dateKey(now),
      month = today.slice(0, 7),
      elapsed = now.getDate();
    const remaining =
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - elapsed;
    const excluded = new Set(investmentAccounts);
    const cash = transactions.filter(
      (t) => t.date <= today && !excluded.has(t.acc),
    );
    const convert = (t) => Number(t.amt) * (t.curr === "USD" ? rate : 1);
    const balance = cash.reduce(
      (n, t) => n + (t.type === "income" ? 1 : -1) * convert(t),
      0,
    );
    const expenses = cash.filter(
      (t) =>
        t.type === "expense" &&
        t.cat !== "Transfer" &&
        t.cat !== "Initial Balance" &&
        t.date.startsWith(month),
    );
    const spending = expenses.reduce((n, t) => n + convert(t), 0);
    const burn = spending / elapsed;
    const hasHistory = expenses.length > 0;
    const baseline = balance - burn * remaining;
    return {
      today,
      elapsed,
      remaining,
      balance,
      spending,
      burn,
      baseline,
      hasHistory,
      projected:
        baseline +
        (burn *
          remaining *
          Math.max(0, Math.min(100, Number(reduction) || 0))) /
          100 +
        Math.max(0, Number(incoming) || 0),
      runway: burn > 0 ? Math.max(0, balance) / burn : null,
      entries: expenses.length,
    };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { project, dateKey };
  else root.FinTracker.insights = { project, dateKey };
})(globalThis);
