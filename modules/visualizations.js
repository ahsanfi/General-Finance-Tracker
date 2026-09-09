window.FinTracker = window.FinTracker || {};
(() => {
  const colors = ['#146a82', '#287f96', '#428fa2', '#5e9cac', '#79aab6', '#8c979f'];
  const escape = value => FinTracker.escape(String(value));
  const money = (value, currency = 'IDR') => currency + ' ' + new Intl.NumberFormat('en-US', {maximumFractionDigits: currency === 'USD' ? 2 : 0}).format(value);
  const percent = (value, total) => total > 0 ? value / total * 100 : 0;
  function summarize(items) {
    if (items.length <= 6) return items;
    return [...items.slice(0, 5), {name: 'Other', value: items.slice(5).reduce((sum, item) => sum + item.value, 0), pnl: items.slice(5).reduce((sum, item) => sum + (item.pnl || 0), 0), other: true}];
  }
  function rows(items, total, currency, performance = false) {
    return items.map(item => `<div class="data-allocation-row"><span>${escape(item.name)}</span><strong>${money(item.value, currency)}</strong><span>${percent(item.value, total).toFixed(1)}%</span>${performance ? `<span class="holding-performance ${item.pnl < 0 ? 'loss' : 'gain'}">${item.cash ? 'Cash' : `${item.pnl >= 0 ? '+' : 'âˆ’'}${money(Math.abs(item.pnl))}`}</span>` : ''}</div>`).join('');
  }
  function details(items, total, currency, performance, previous) {
    return `<details class="allocation-breakdown" ${previous ? 'open' : ''}><summary>View all ${items.length} ${performance ? 'holdings' : 'categories'}</summary><div class="allocation-data ${performance ? 'with-performance' : ''}">${rows(items, total, currency, performance)}</div></details>`;
  }
  function spending(items, currency, comparison) {
    const host = document.getElementById('spending-visualization');
    const open = host.querySelector('details')?.open;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) { host.innerHTML = `<p class="visual-empty">No expenses recorded in ${currency}.</p>`; return; }
    const visible = summarize(items);
    let angle = -Math.PI / 2;
    const cx = 310, cy = 170, radius = 95;
    let cursor = angle;
    const labelSlots = visible.map((item, i) => {
      const mid = cursor + item.value / total * Math.PI;
      cursor += item.value / total * Math.PI * 2;
      return {i, left: Math.cos(mid) < 0, y: Math.sin(mid)};
    });
    for (const left of [true,false]) {
      const side = labelSlots.filter(slot=>slot.left===left).sort((a,b)=>a.y-b.y);
      side.forEach((slot,i)=>slot.labelY=side.length===1?160:35+i*270/(side.length-1));
    }
    const arcs = visible.map((item, i) => {
      const size = item.value / total * Math.PI * 2;
      const end = angle + size;
      const mid = angle + size / 2;
      const point = a => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
      const [x1, y1] = point(angle), [x2, y2] = point(end - .00001);
      const [mx, my] = point(mid);
      const slot = labelSlots[i], y = slot.labelY;
      const textX = slot.left ? 5 : 445, elbow = slot.left ? 183 : 435;
      const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${size > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
      angle = end;
      return `<g class="spending-segment" tabindex="0" aria-label="${escape(item.name)}, ${money(item.value,currency)}, ${percent(item.value,total).toFixed(1)} percent"><title>${escape(item.name)}: ${money(item.value,currency)}</title><path d="${path}" fill="none" stroke="${colors[i]}" stroke-width="22"/><path class="segment-connector" d="M ${mx} ${my} L ${elbow} ${y+7} L ${slot.left?175:440} ${y+7}" fill="none" stroke="${colors[i]}" stroke-width="1"/><text x="${textX}" y="${y}" class="segment-name">${escape(item.name.length > 22 ? item.name.slice(0,21)+'â€¦' : item.name)}</text><text x="${textX}" y="${y+21}" class="segment-value">${money(item.value,currency)}</text><text x="${textX}" y="${y+37}" class="segment-value">${percent(item.value,total).toFixed(1)}%</text></g>`;
    }).join('');
    host.innerHTML = `<svg class="spending-arcs" viewBox="0 0 620 350" role="group" aria-label="Spending by category">${arcs}<text x="310" y="150" text-anchor="middle" class="radial-caption">TOTAL SPENDING</text><text x="310" y="177" text-anchor="middle" class="radial-total">${money(total,currency)}</text><text x="310" y="199" text-anchor="middle" class="radial-caption">All recorded expenses</text></svg><div class="spending-mobile"><span class="visual-caption">Total spending Â· all time</span><strong class="mobile-spending-total">${money(total,currency)}</strong>${visible.map((item,i)=>`<div class="direct-category"><span class="direct-category-name">${escape(item.name)}</span><strong>${money(item.value,currency)}</strong><span>${percent(item.value,total).toFixed(1)}%</span><div class="direct-category-track"><span style="width:${percent(item.value,total)}%;background:${colors[i]}"></span></div></div>`).join('')}</div><p class="spending-comparison">${escape(comparison)}</p>${details(items,total,currency,false,open)}`;
  }
  function split(items, x=0, y=0, width=100, height=100) {
    const total=items.reduce((sum,item)=>sum+item.value,0);
    const rowCount=items.length>3?2:1, perRow=Math.ceil(items.length/rowCount);
    const boxes=[];
    let top=y;
    for(let start=0;start<items.length;start+=perRow){
      const row=items.slice(start,start+perRow), sum=row.reduce((s,item)=>s+item.value,0), rowHeight=height*sum/total;
      let left=x;
      row.forEach(item=>{const boxWidth=width*item.value/sum;boxes.push({...item,x:left,y:top,width:boxWidth,height:rowHeight});left+=boxWidth;});
      top+=rowHeight;
    }
    return boxes;
  }  function portfolio(items) {
    const host=document.getElementById('portfolio-visualization');
    const open=host.querySelector('details')?.open;
    const total=items.reduce((sum,item)=>sum+item.value,0);
    if(!total){host.innerHTML='<p class="visual-empty">Add a holding to see allocation and performance.</p>';return;}
    const visible=summarize(items).map((item,i)=>({...item,color:colors[i]}));
    host.innerHTML=`<div class="allocation-title"><h3>Allocation & performance</h3><span>Area represents current value Â· IDR</span></div><div class="holding-treemap">${split(visible,0,0,1000,310).map(box=>{ const item={...box,x:box.x/10,y:box.y/3.1,width:box.width/10,height:box.height/3.1}; return `<button type="button" class="holding-tile" style="left:${item.x}%;top:${item.y}%;width:${item.width}%;height:${item.height}%;--holding-color:${item.color}" data-holding="${escape(item.id||'')}" ${item.other?'data-other="true"':''}><span class="holding-name">${escape(item.name)}</span><strong>${money(item.value)}</strong><span class="holding-weight">${percent(item.value,total).toFixed(1)}% of portfolio</span><span class="holding-performance ${item.pnl<0?'loss':'gain'}">${item.cash?'Unallocated cash':`${item.pnl>=0?'+':'âˆ’'}${money(Math.abs(item.pnl))} P&L`}</span></button>`; }).join('')}</div>${details(items,total,'IDR',true,open)}`;
    if (visible.some(item => item.value / total < 0.06)) { host.querySelector('.holding-treemap').classList.add('is-list'); host.querySelector('.allocation-title > span').textContent = 'Current value, allocation and P&L · IDR'; }
    host.querySelectorAll('.holding-tile').forEach(button=>button.onclick=()=>{
      if(button.dataset.other) host.querySelector('details').open=true;
      else if(button.dataset.holding) window.openPortfolioModal(button.dataset.holding);
    });
  }
  function trendData(data, rate, today = new Date(), timeframe = '30') {
    const day = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    // Calendar windows end today; comparison uses the same number of preceding days.
    const end = new Date(today.getFullYear(),today.getMonth(),today.getDate());
    let count = timeframe === '7' ? 7 : 30;
    if (timeframe === '3m' || timeframe === '1y') {
      const months = timeframe === '3m' ? 3 : 12;
      const monthStart = new Date(end.getFullYear(),end.getMonth()-months,1);
      const lastDay = new Date(monthStart.getFullYear(),monthStart.getMonth()+1,0).getDate();
      const start = new Date(monthStart.getFullYear(),monthStart.getMonth(),Math.min(end.getDate(),lastDay));
      count = Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);
    }
    const dates = Array.from({length:count*2},(_,i)=>day(new Date(end.getFullYear(),end.getMonth(),end.getDate()-count*2+1+i)));
    const totals = new Map(dates.map(date=>[date,0]));
    data.forEach(item=>{ const date=String(item.date).slice(0,10); if(item.type==='expense' && item.cat!=='Transfer' && totals.has(date)) totals.set(date,totals.get(date)+item.amt*(item.curr==='USD'?rate:1)); });
    const values=dates.slice(count).map(date=>totals.get(date)), total=values.reduce((a,b)=>a+b,0);
    const previous=dates.slice(0,count).reduce((sum,date)=>sum+totals.get(date),0);
    return {dates:dates.slice(count),values,total,previous,average:total/count,peak:Math.max(...values),count};
  }
  FinTracker.visualizations={spending,portfolio,summarize,split,trendData};
  document.addEventListener('DOMContentLoaded',()=>{
    const spending=document.querySelector('.spending-surface'), trend=document.querySelector('.trend-surface');
    new ResizeObserver(()=>{
      const detail=spending.querySelector('details[open] .allocation-data');
      const height=spending.getBoundingClientRect().height-(detail?.getBoundingClientRect().height||0);
      trend.style.setProperty('--overview-card-height',`${Math.ceil(height)}px`);
    }).observe(spending);
  });
})();



