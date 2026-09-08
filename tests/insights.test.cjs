const test=require('node:test');
const assert=require('node:assert/strict');
const {project}=require('../modules/insights.js');
const now=new Date(2026,8,10,12);
const t=(type,amt,date='2026-09-05',extra={})=>({type,amt,date,acc:'Bank',curr:'IDR',cat:type==='expense'?'Food':'Salary',...extra});
test('cash projection excludes future rows, transfers from burn, and investment accounts',()=>{
  const data=[t('income',10000),t('expense',1000),t('expense',2000,'2026-09-06',{cat:'Transfer'}),t('income',2000,'2026-09-06',{cat:'Transfer',acc:'Cash'}),t('expense',100000,'2026-09-01',{acc:'Broker'}),t('income',999999,'2026-09-30')];
  const r=project(data,['Broker'],16000,now);
  assert.equal(r.balance,9000);assert.equal(r.burn,100);assert.equal(r.remaining,20);assert.equal(r.baseline,7000);assert.equal(r.entries,1);
});
test('scenario reduction affects remaining spending only, with explicit income',()=>{
  const r=project([t('income',10000),t('expense',1000)],[],16000,now,50,2000);
  assert.equal(r.projected,10000);assert.equal(r.baseline,7000);
});
test('USD conversion, leap month end, and zero-history states remain finite',()=>{
  const end=new Date(2024,1,29,12),r=project([t('expense',10,'2024-02-29',{curr:'USD'})],[],16000,end);
  assert.equal(r.remaining,0);assert.equal(r.balance,-160000);assert.equal(r.projected,-160000);
  const empty=project([],[],16000,now);assert.equal(empty.hasHistory,false);assert.equal(empty.runway,null);assert.equal(empty.projected,0);
});
