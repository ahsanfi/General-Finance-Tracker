/* Isolated local visual preview. This file is never included in the production page. */
(() => {
  'use strict';
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Preview fixtures are local-only.');
  const now = new Date(), month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const date = day => `${month}-${String(day).padStart(2,'0')}`;
  const header = ['Date','Description','Category','Account','Currency','Amount'];
  const data = {
    status:'success', rate:16000,
    income:[header,[date(1),'Opening balance','Initial Balance','Bank','IDR',5000000],[date(1),'Monthly salary','Salary','Bank','IDR',15000000],[date(2),'Design project','Freelance','PayPal','USD',500],[date(3),'Investment funding','Transfer','Tokocrypto','IDR',2000000]],
    expenses:[header,[date(3),'Investment funding','Transfer','Bank','IDR',2000000],[date(3),'Apartment rent','Housing','Bank','IDR',3000000],[date(4),'Weekly groceries','Food','Bank','IDR',650000],[date(5),'Coffee with friends','Food','Bank','IDR',85000],[date(5),'Internet & phone','Bills','Bank','IDR',450000],[date(6),'Train pass','Transport','Bank','IDR',250000],[date(6),'Design software','Software','PayPal','USD',25]],
    portfolio:[{id:'preview-asset',name:'BTC',platform:'Tokocrypto',currency:'IDR',invested:1500000,currentValue:1750000,balance:0.001}]
  };
  const config = {status:'success',exp:['Food','Housing','Bills','Transport','Software','Transfer'],inc:['Salary','Freelance','Initial Balance','Transfer'],walletsIDR:['Bank','Cash','Tokocrypto'],walletsUSD:['PayPal'],allowedEmails:['preview@example.invalid'],investmentAccounts:['Tokocrypto'],pin:null,tokoApiKey:'',tokoSecretKey:''};
  let budgets = {[month]:{Food:1500000,Housing:3500000,Transport:600000}};
  const originalFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    const target = new URL(url, location.href);
    if (target.origin === location.origin && !target.pathname.startsWith('/proxy/')) return originalFetch(url, options);
    return Promise.reject(new Error('External integrations are not connected in this sample preview.'));
  };
  const row = p => [p.date,p.description ?? p.desc ?? p.note,p.category ?? p.cat,p.account ?? p.acc,p.currency ?? p.curr,Number(p.amount ?? p.amt)];
  const table = name => name === 'Income' ? data.income : data.expenses;
  window.FinTrackerPreview = {
    calls: [], failNext: null,
    async request(payload) {
      this.calls.push(payload.action);
      await new Promise(resolve => setTimeout(resolve, 120));
      if (this.failNext === payload.action) { this.failNext = null; return {status:'error',message:'Simulated connection failure. Your form has been kept.'}; }
      let result = {};
      switch (payload.action) {
        case 'getBootstrap': result={config,data,budgets,email:'preview@example.invalid'};break;
        case 'getSystemConfig': result=config;break;
        case 'getData': result=data;break;
        case 'getBudgets': result={budgets};break;
        case 'getPortfolio': result={portfolio:data.portfolio};break;
        case 'add': table(payload.sheetName).push(row(payload));break;
        case 'addTransaction': table(payload.type==='income'?'Income':'Expenses').push(row(payload));break;
        case 'transfer':
          data.expenses.push(row({date:payload.date,description:`Transfer Out to ${payload.toAccount} (${payload.description})`,category:'Transfer',account:payload.fromAccount,currency:payload.fromCurrency,amount:payload.fromAmount}));
          data.income.push(row({date:payload.date,description:`Transfer In from ${payload.fromAccount} (${payload.description})`,category:'Transfer',account:payload.toAccount,currency:payload.toCurrency,amount:payload.toAmount}));break;
        case 'edit': case 'delete': {
          const source=table(payload.oldSheetName||payload.sheetName),expected=row(payload.originalData);
          const index=source.findIndex((r,i)=>i>0 && JSON.stringify(r)===JSON.stringify(expected));
          if(index<0)return {status:'error',message:'Transaction changed. Refresh and try again.'};
          source.splice(index,1);if(payload.action==='edit')table(payload.newSheetName).push(row(payload.newData));break;
        }
        case 'updatePortfolio':
          if(payload.expectedPortfolio && JSON.stringify(payload.expectedPortfolio)!==JSON.stringify(data.portfolio)) return {status:'error',message:'Portfolio changed. Refresh before saving.'};
          data.portfolio=structuredClone(payload.portfolio);
          if(payload.realized) { const t=payload.realized; data[t.type==='income'?'income':'expenses'].push([t.date,t.description,t.category,t.account,t.currency,t.amount]); }
          break;
        case 'updateSystemConfig': Object.assign(config,payload.config);break;
        case 'setBudget': budgets[payload.month]??={};if(Number(payload.amount)>0)budgets[payload.month][payload.category]=Number(payload.amount);else delete budgets[payload.month][payload.category];break;
        case 'syncTokocrypto': return {status:'error',message:'Tokocrypto is not connected in the sample preview. No real account was accessed.'};
        default: return {status:'error',message:'This operation requires a connected deployment.'};
      }
      return structuredClone({status:'success',message:'Saved in sample preview.',...result});
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('p');
    banner.className = 'preview-notice'; banner.textContent = 'SAMPLE PREVIEW · Edits reset on reload · No live accounts connected';
    document.getElementById('tab-content').prepend(banner);
  });
})();
