(() => {
  let selectedDate = null;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function render(data, month, formatMoney) {
    const grid=document.getElementById('calendar-grid'), fragment=document.createDocumentFragment();
    const year=month.getFullYear(), index=month.getMonth(), today=dateKey(new Date());
    const byDate=new Map();
    data.forEach(item=>{const rows=byDate.get(item.date)||[];rows.push(item);byDate.set(item.date,rows);});
    document.getElementById('calendar-header').textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    for(let i=0;i<new Date(year,index,1).getDay();i++)fragment.append(document.createElement('div'));
    for(let number=1;number<=new Date(year,index+1,0).getDate();number++){
      const date=new Date(year,index,number), key=dateKey(date), items=byDate.get(key)||[];
      const button=document.createElement('button');button.type='button';button.className='calendar-day';button.dataset.date=key;
      button.setAttribute('aria-label',`${date.toLocaleDateString(undefined,{dateStyle:'full'})}, ${items.length} transactions`);
      button.setAttribute('aria-pressed',String(key===selectedDate));
      if(key===today)button.setAttribute('aria-current','date');
      const day=document.createElement('span');day.className='calendar-number';day.textContent=number;
      const dots=document.createElement('span');dots.className='calendar-dots';dots.setAttribute('aria-hidden','true');
      for(const type of ['income','expense'])if(items.some(item=>item.type===type)){const dot=document.createElement('i');dot.className=type;dots.append(dot);}
      button.append(day,dots);
      button.onclick=()=>{
        // Selection belongs to the calendar, so closing the sheet keeps its outline.
        selectedDate=key;grid.querySelectorAll('button').forEach(day=>day.setAttribute('aria-pressed',String(day===button)));
        document.getElementById('cal-detail-title').textContent=date.toLocaleDateString(undefined,{dateStyle:'full'});
        const list=document.getElementById('cal-detail-content');list.replaceChildren();
        items.forEach(item=>{
          const row=document.createElement('div');row.className='calendar-transaction';
          const detail=document.createElement('div'), title=document.createElement('strong'), meta=document.createElement('span');
          title.textContent=item.desc;meta.textContent=`${item.cat} · ${item.acc}`;detail.append(title,meta);
          const amount=document.createElement('strong');amount.className=`calendar-amount ${item.type}`;amount.textContent=`${item.type==='income'?'+':'−'} ${formatMoney(item.amt,item.curr)}`;
          row.append(detail,amount);list.append(row);
        });
        if(!items.length){const empty=document.createElement('p');empty.className='calendar-empty';empty.textContent='No transactions on this day.';list.append(empty);}
        document.getElementById('calendar-detail-modal').classList.remove('hidden');
      };
      fragment.append(button);
    }
    grid.replaceChildren(fragment);
  }
  FinTracker.calendar={render};
})();
