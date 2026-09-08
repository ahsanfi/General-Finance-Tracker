/* Testable accounting and calculator functions; no DOM or service dependencies. */
(function (root) {
  const convert = (value, from, to, rate) =>
    from === to ? value : from === "USD" ? value * rate : value / rate;
  function summarize(transactions, portfolio, investmentAccounts, rate) {
    const wallets = new Map();
    let income = 0,
      expense = 0;
    for (const t of transactions) {
      const key = JSON.stringify([t.acc, t.curr]);
      if (!wallets.has(key)) wallets.set(key, { n: t.acc, c: t.curr, v: 0 });
      const wallet = wallets.get(key);
      wallet.v += (t.type === "income" ? 1 : -1) * t.amt;
      if (t.cat !== "Transfer") {
        if (t.type === "income" && t.cat !== "Initial Balance")
          income += convert(t.amt, t.curr, "IDR", rate);
        else if (t.type === "expense")
          expense += convert(t.amt, t.curr, "IDR", rate);
      }
    }
    let wealth = 0;
    for (const wallet of wallets.values()) {
      wallet.investment = investmentAccounts.includes(wallet.n);
      const assets = portfolio.filter((a) => a.platform === wallet.n);
      const pnl = wallet.investment
        ? assets.reduce(
            (n, a) =>
              n +
              convert(a.currentValue - a.invested, a.currency, wallet.c, rate),
            0,
          )
        : 0;
      wallet.display = wallet.v + pnl;
      wealth += convert(wallet.display, wallet.c, "IDR", rate);
    }
    return {
      income,
      expense,
      net: income - expense,
      wealth,
      wallets: [...wallets.values()],
    };
  }
  function calculate(expression) {
    const input = String(expression).trim();
    if (!input || input.length > 200 || !/^[\d\s+*/().-]+$/.test(input))
      return null;
    const tokens = input.match(/\d*\.\d+|\d+\.?\d*|[()+*/-]/g) || [];
    let position = 0;
    const atom = () => {
      const token = tokens[position++];
      if (token === "+") return atom();
      if (token === "-") return -atom();
      if (token === "(") {
        const result = sum();
        if (tokens[position++] !== ")") throw Error();
        return result;
      }
      if (!token || !/^\d|^\.\d/.test(token)) throw Error();
      return Number(token);
    };
    const product = () => {
      let n = atom();
      while (["*", "/"].includes(tokens[position])) {
        const op = tokens[position++],
          v = atom();
        n = op === "*" ? n * v : n / v;
      }
      return n;
    };
    const sum = () => {
      let n = product();
      while (["+", "-"].includes(tokens[position])) {
        const op = tokens[position++],
          v = product();
        n = op === "+" ? n + v : n - v;
      }
      return n;
    };
    try {
      const result = sum();
      return position === tokens.length &&
        Number.isFinite(result) &&
        result >= 0
        ? Math.round(result * 100) / 100
        : null;
    } catch {
      return null;
    }
  }
  function transferAmount(
    source,
    sourceCurrency,
    targetCurrency,
    rate,
    explicit,
  ) {
    return explicit !== ""
      ? Number(explicit)
      : Math.round(
          convert(source, sourceCurrency, targetCurrency, rate) * 100,
        ) / 100;
  }
  const domain = { summarize, calculate, convert, transferAmount };
  if (typeof module !== "undefined" && module.exports) module.exports = domain;
  else {
    root.FinTracker ??= {};
    root.FinTracker.domain = domain;
  }
})(globalThis);
