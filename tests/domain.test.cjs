const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize,calculate,transferAmount}=require('../modules/domain.js');
test('accounting preserves transfer, opening balance and investment P&L rules',()=>{
  const entries=[{type:'income',cat:'Initial Balance',acc:'Bank',curr:'IDR',amt:500},{type:'income',cat:'Salary',acc:'Bank',curr:'IDR',amt:1000},{type:'expense',cat:'Transfer',acc:'Bank',curr:'IDR',amt:200},{type:'income',cat:'Transfer',acc:'Investment',curr:'IDR',amt:200},{type:'expense',cat:'Food',acc:'Bank',curr:'IDR',amt:50},{type:'income',cat:'Freelance',acc:'PayPal',curr:'USD',amt:2}];
  const result=summarize(entries,[{platform:'Investment',currency:'IDR',invested:100,currentValue:130}],['Investment'],16000);
  assert.equal(result.income,33000);assert.equal(result.expense,50);assert.equal(result.net,32950);assert.equal(result.wealth,33480);
});
test('calculator supports precedence, parentheses and decimals without eval',()=>{
  assert.equal(calculate('12.5 + 7.5 * 2'),27.5);assert.equal(calculate('(12 + 8) / 2'),10);assert.equal(calculate('-2 + 5'),3);
  for(const text of ['1/0','alert(1)','2**3','1 +','-5','1 2'])assert.equal(calculate(text),null,text);
});
test('cross-currency transfer auto amount and explicit override',()=>{
  assert.equal(transferAmount(160000,'IDR','USD',16000,''),10);assert.equal(transferAmount(10,'USD','IDR',16000,''),160000);assert.equal(transferAmount(10,'USD','IDR',16000,'150000'),150000);
});
