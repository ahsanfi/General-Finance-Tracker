/* Dashboard renders semantic cards from the domain model; no sheet/API calls. */
(() => {
  const element = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  FinTracker.dashboard = {
    render(transactions, portfolio, config, rate, format) {
      const model = FinTracker.domain.summarize(
        transactions,
        portfolio,
        config.investmentAccounts || [],
        rate,
      );
      for (const [id, key] of [
        ["summary-income", "income"],
        ["summary-expense", "expense"],
        ["summary-net", "net"],
      ])
        document.querySelector(`#${id} .stat-value`).textContent = format(
          model[key],
          "IDR",
        );
      document.getElementById("wealth-display").textContent =
        window.isBalancesHidden
          ? "***"
          : new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "IDR",
              maximumFractionDigits: 0,
            }).format(model.wealth);
      document.getElementById("rate-display").textContent =
        `1 USD = ${format(rate, "IDR")}`;
      const list = document.getElementById("account-balances-container");
      list.replaceChildren();
      model.wallets
        .sort((a, b) => a.n.localeCompare(b.n))
        .forEach((wallet, index) => {
          const card = element(
            "article",
            "wallet-card" + (wallet.investment ? " is-investment" : ""),
          );
          const title = element("div", "wallet-heading");
          title.append(
            element(
              "span",
              "wallet-avatar",
              wallet.n.slice(0, 1).toUpperCase(),
            ),
            element("span", "wallet-name", wallet.n),
          );
          const value = element(
            wallet.c === "USD" ? "button" : "strong",
            "wallet-value",
            format(wallet.display, wallet.c),
          );
          value.id = `bal-${index}`;
          if (wallet.c === "USD") {
            value.type = "button";
            value.setAttribute("aria-label", `Convert ${wallet.n} balance`);
            value.addEventListener("click", () =>
              window.toggleCurrency(value.id, wallet.display),
            );
          }
          card.append(
            title,
            value,
            element(
              "small",
              "wallet-meta",
              wallet.investment
                ? "Investment account"
                : wallet.c === "USD"
                  ? "USD · tap balance to convert"
                  : "IDR · cash account",
            ),
          );
          list.append(card);
        });
      if (!model.wallets.length)
        list.append(
          element(
            "p",
            "empty-copy",
            "Your wallets appear here after your first entry.",
          ),
        );
      document.getElementById("dashboard-record-count").textContent =
        `${transactions.length} recorded transactions`;
      FinTracker.store.patch({ transactions, portfolio, config, rate });
      return Object.fromEntries(model.wallets.map((w, i) => [i, w]));
    },
  };
})();
