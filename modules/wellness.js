/* FinTracker's transparent planning indicator; not a standardized wellness scale. */
(function(root) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const clamp = value => Math.max(0, Math.min(100, value));
  function calculate(transactions = [], investmentAccounts = [], budgets = {}, rate = 16000, now = new Date()) {
    const today = key(now), excluded = new Set(investmentAccounts.map(normalize));
    const fx = Number.isFinite(rate) && rate > 0 ? rate : 16000;
    const rows = transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.date <= today &&
      ['income','expense'].includes(t.type) && ['USD','IDR'].includes(t.curr) && Number.isFinite(Number(t.amt)) && Number(t.amt) >= 0);
    const cashRows = rows.filter(t => !excluded.has(normalize(t.acc)));
    const value = t => Number(t.amt) * (t.curr === 'USD' ? fx : 1);
    const cash = cashRows.reduce((sum,t) => sum + value(t) * (t.type === 'income' ? 1 : -1), 0);
    const firstDate = rows.map(t => t.date).sort()[0];
    // Exclude an initial partial month; subsequent empty months remain in the window.
    const months = Array.from({length:3}, (_,i) => key(new Date(now.getFullYear(), now.getMonth()-3+i, 1)))
      .filter(start => firstDate && firstDate <= start).map(start => start.slice(0,7));
    const totals = months.map(month => ({month,income:0,expense:0,categories:{}}));
    for (const t of cashRows) {
      if (['transfer','initial balance'].includes(normalize(t.cat))) continue;
      const bucket = totals.find(item => item.month === t.date.slice(0,7));
      if (!bucket) continue;
      bucket[t.type] += value(t);
      if (t.type === 'expense') bucket.categories[normalize(t.cat)] = (bucket.categories[normalize(t.cat)] || 0) + value(t);
    }
    const income = totals.reduce((sum,t) => sum+t.income,0), expense = totals.reduce((sum,t) => sum+t.expense,0);
    const averageExpense = months.length ? expense/months.length : 0;
    const reserveMonths = averageExpense > 0 ? Math.max(0,cash)/averageExpense : null;
    const savingsRate = income > 0 ? (income-expense)/income : null;
    const surplusMonths = totals.filter(t => t.income >= t.expense).length;
    let budgetLimit = 0, overruns = 0, budgetedSpending = 0;
    for (const bucket of totals) {
      for (const [category, rawLimit] of Object.entries(budgets[bucket.month] || {})) {
        const limit = Number(rawLimit), cat = normalize(category);
        if (!(limit > 0) || !Number.isFinite(limit) || ['transfer','initial balance'].includes(cat)) continue;
        const spent = bucket.categories[cat] || 0;
        budgetLimit += limit;
        budgetedSpending += spent;
        overruns += Math.max(0,spent-limit);
      }
    }
    const components = [
      {id:'reserve',name:'Cash reserve',weight:35,score:reserveMonths === null ? null : clamp(reserveMonths/6*100),value:reserveMonths},
      {id:'savings',name:'Savings rate',weight:30,score:savingsRate === null ? null : clamp(savingsRate/0.2*100),value:savingsRate},
      {id:'stability',name:'Cash-flow stability',weight:20,score:months.length && income+expense > 0 ? surplusMonths/months.length*100 : null,value:surplusMonths},
      {id:'budget',name:'Budget adherence',weight:15,score:budgetLimit > 0 && income+expense > 0 ? clamp((1-overruns/budgetLimit)*100) : null,value:overruns},
    ];
    const assessed = components.filter(c => c.score !== null), coverage = assessed.reduce((sum,c) => sum+c.weight,0);
    return {score:coverage ? Math.round(assessed.reduce((sum,c) => sum+c.score*c.weight,0)/coverage) : null,
      components,coverage,months,cash,averageExpense,income,expense,budgetLimit,budgetedSpending,fx};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate};
  else root.FinTracker.wellness = {calculate};
})(globalThis);
