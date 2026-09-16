document.addEventListener('DOMContentLoaded', () => {
  const section = document.createElement('section');
  section.className = 'wellness-panel';
  section.id = 'financial-wellness';
  section.setAttribute('aria-labelledby','wellness-title');
  section.innerHTML = `<header class="wellness-header"><div><h3 id="wellness-title">Financial Wellness Score</h3><p>Debt-free · Provided by you</p><p id="wellness-period"></p></div><div class="wellness-total"><strong id="wellness-score">—</strong><span> / 100</span><p id="wellness-coverage"></p></div></header><div id="wellness-components" class="wellness-components"></div><details class="wellness-method"><summary>How your score is calculated</summary><p>A custom FinTracker indicator based on recorded cash flows. It is not a credit score or a standardized financial well-being assessment.</p><ul><li>Cash reserve (35%): available cash divided by average monthly expenses. Six months earns full points.</li><li>Savings rate (30%): income minus expenses, divided by income. A 20% savings rate earns full points.</li><li>Cash-flow stability (20%): share of assessed months where income covers expenses.</li><li>Budget adherence (15%): 100 × (1 − category overruns ÷ configured budget limits), floored at zero. Underspending in one category does not cancel another category’s overrun. Only configured categories are assessed.</li></ul><p>These targets and weights are app design choices, not universal financial standards. Unassessed components are excluded and the remaining weights are rescaled to 100.</p><p>Uses up to three completed months after the start of your records; an initial partial month is excluded. Empty months inside that window count, so missing records can affect results. Cash is calculated through today and includes initial balances and transfers. Income and expenses exclude transfers, initial balances and investment-account activity. Insurance and other monthly expenses are included. USD uses your current exchange rate; budgets are in IDR.</p></details>`;
  document.getElementById('financial-outlook').after(section);
  const money = n => 'IDR ' + new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
  const formatMonth = month => new Date(month+'-01T12:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  function render() {
    const state = FinTracker.store.get();
    const model = FinTracker.wellness.calculate(state.transactions,state.config.investmentAccounts,state.budgets,state.rate);
    const hidden = window.isBalancesHidden;
    const loaded = state.ledgerLoaded;
    const score = document.getElementById('wellness-score');
    score.textContent = hidden ? '••••' : !loaded ? '…' : model.score === null ? '—' : model.score;
    document.getElementById('wellness-period').textContent = model.months.length ? `${formatMonth(model.months[0])} – ${formatMonth(model.months.at(-1))} · ${model.months.length} completed months` : 'Needs at least one completed month of records';
    document.getElementById('wellness-coverage').textContent = !loaded ? 'Waiting for your data' : model.score === null ? 'Not assessed' : `${model.components.filter(c=>c.score!==null).length}/4 components assessed${model.months.length < 3 ? ' · Early estimate' : ''}`;
    const notes = {
      reserve:model.averageExpense > 0 ? `${(Math.max(0,model.cash)/model.averageExpense).toFixed(1)} months covered · ${money(model.averageExpense)} typical monthly expenses` : 'Needs completed-month expenses',
      savings:model.income > 0 ? `${((model.income-model.expense)/model.income*100).toFixed(1)}% of income retained after spending` : 'No recorded income in the assessed months',
      stability:`${model.components[2].value} of ${model.months.length} months with income covering expenses`,
      budget:model.budgetLimit > 0 ? `${money(model.components[3].value)} over configured limits · ${model.expense > 0 ? Math.round(model.budgetedSpending/model.expense*100) : 0}% of spending assessed` : 'No budgets configured for the assessed months',
    };
    const list = document.getElementById('wellness-components');
    list.replaceChildren(...model.components.map(component => {
      const item = document.createElement('div');
      item.className = 'wellness-component';
      const heading = document.createElement('div');
      heading.className = 'wellness-component-heading';
      const label = document.createElement('h4'); label.textContent = component.name;
      const points = document.createElement('span'); points.textContent = hidden ? '••••' : !loaded ? 'Waiting for data' : component.score === null ? 'Not assessed' : `${Math.round(component.score)}/100`;
      heading.append(label,points);
      const note = document.createElement('p'); note.textContent = hidden ? 'Details hidden' : !loaded ? 'Calculating when data is available' : notes[component.id];
      const bar = document.createElement('div'); bar.className='wellness-bar'; bar.setAttribute('aria-hidden','true');
      const fill = document.createElement('span'); fill.style.width= hidden || !loaded ? '0%' : (component.score || 0)+'%'; bar.append(fill);
      item.append(heading,note,bar); return item;
    }));
  }
  let frame;
  FinTracker.store.subscribe(() => {cancelAnimationFrame(frame); frame=requestAnimationFrame(render);});
  render();
});
