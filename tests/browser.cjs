const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const routes=new Set(['index.html','preview.html','config.js','app.js','style.css','shell.js','shell.css','preview/fixtures.js',...fs.readdirSync('modules').map(file=>'modules/'+file)]);
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=new URL(req.url,'http://localhost').pathname.slice(1);
    if(!routes.has(file)){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'}).end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}/preview.html`;
    await page.goto(url);
    await page.waitForFunction(()=>window.masterData?.length===11);
    assert.equal((await page.locator('#summary-income .stat-value').textContent()).replace(/\s/g,''),'IDR23,000,000');
    assert.equal((await page.locator('#wealth-display').textContent()).replace(/\s/g,''),'IDR23,415,000');
    assert.deepEqual(await page.evaluate(()=>FinTrackerPreview.calls),['getBootstrap'],'one bootstrap request');
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>FinTracker.theme.set(theme),theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      const surface=await page.evaluate(()=>FinTracker.theme.token('--surface'));
      assert.equal(await page.evaluate(()=>Chart.getChart('expense-pie-chart').data.datasets[0].borderColor),surface);
    }
    await page.reload();await page.waitForFunction(()=>window.masterData?.length===11);assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('#desk-tab-add').click();
    await page.locator('#entry-desc').fill('Browser check');await page.locator('#entry-amt-source').fill('12.5 + 7.5');
    await page.locator('#submit-btn').click();await page.waitForFunction(()=>window.masterData?.length===12);
    assert.equal(await page.evaluate(()=>masterData.find(t=>t.desc==='Browser check').amt),20);
    await page.locator('#entry-desc').fill('Keep this form');await page.locator('#entry-amt-source').fill('25');
    await page.evaluate(()=>FinTrackerPreview.failNext='add');await page.locator('#submit-btn').click();
    await page.waitForSelector('#entry-feedback:not([hidden])');assert.equal(await page.locator('#entry-desc').inputValue(),'Keep this form');
    await page.locator('#entry-type-transfer').check();await page.locator('#entry-desc').fill('Cross currency');await page.locator('#entry-amt-source').fill('160000');
    await page.locator('#entry-curr-target').selectOption('USD');await page.locator('#entry-acc-target').selectOption('PayPal');await page.locator('#entry-amt-target').fill('');
    await page.locator('#submit-btn').click();await page.waitForFunction(()=>window.masterData?.length===14);
    assert.equal(await page.evaluate(()=>masterData.find(t=>t.desc.includes('Cross currency')&&t.type==='income').amt),10);
    await page.locator('#desk-tab-transactions').click();await page.locator('#filter-search').fill('Browser check');
    await page.locator('#data-body .edit-btn').click();await page.locator('#entry-amt-source').fill('40');await page.locator('#submit-btn').click();
    await page.waitForFunction(()=>window.masterData?.find(t=>t.desc==='Browser check')?.amt===40);
    await page.locator('#desk-tab-transactions').click();await page.locator('#data-body .del-btn').click();await page.locator('#del-confirm').click();
    await page.waitForFunction(()=>window.masterData?.length===13);
    await page.locator('#filter-search').fill('');
    for(const [button,view] of [['desk-tab-daily','view-daily'],['desk-tab-budget','view-budget']]){await page.locator('#'+button).click();assert.ok(await page.locator('#'+view).isVisible());}
    await page.locator('#subtab-investments-btn').click();assert.ok(await page.locator('#btn-sync-toko').isVisible());
    await page.locator('#btn-sync-toko').click();await page.waitForFunction(()=>!document.getElementById('btn-sync-toko').disabled);
    await page.locator('.shell-settings').click();assert.ok(await page.locator('#view-config').isVisible());
    await page.locator('#desk-tab-dashboard').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('#export-csv-btn').click();
    const download=await downloadPromise;assert.ok((await download.suggestedFilename()).endsWith('.csv'));
    await page.waitForFunction(()=>!document.getElementById('toast') || getComputedStyle(document.getElementById('toast')).opacity==='0' || document.getElementById('toast').classList.contains('hidden')).catch(()=>{});
    fs.mkdirSync('artifacts',{recursive:true});
    await page.keyboard.press('Control+k');await page.waitForSelector('#command-palette[open]');
    assert.equal(await page.locator('#command-input').evaluate(el=>el===document.activeElement),true);
    await page.locator('#command-input').fill('Settings');await page.keyboard.press('Enter');
    assert.ok(await page.locator('#view-config').isVisible());
    assert.ok((await page.locator('#config-allowed-emails-list').textContent()).trim().length>0,'command initializes settings');
    await page.keyboard.press('Meta+k');await page.locator('#command-input').fill('Coffee');
    assert.ok((await page.locator('#command-results').textContent()).includes('Coffee'));
    await page.keyboard.press('Escape');assert.ok(!await page.locator('#command-palette').isVisible());
    await page.locator('#desk-tab-dashboard').click();
    const baseline=await page.locator('#scenario-balance').textContent();
    await page.locator('#scenario-incoming').fill('500000');
    await page.waitForFunction(b=>document.getElementById('scenario-balance').textContent!==b,baseline);
    assert.equal(await page.locator('#projected-balance').textContent(),baseline);
    await page.locator('#quick-add-launch').click();
    await page.locator('#quick-amount').fill('10 + 5');await page.locator('#quick-note').fill('Quick capture check');
    await page.evaluate(()=>FinTrackerPreview.failNext='add');await page.locator('#quick-save').click();
    await page.waitForFunction(()=>!document.getElementById('quick-save').disabled);
    assert.equal(await page.locator('#quick-note').inputValue(),'Quick capture check');
    await page.locator('#quick-save').click();await page.waitForFunction(()=>masterData.some(t=>t.desc==='Quick capture check'&&t.amt===15));
    await page.waitForFunction(()=>!document.getElementById('quick-add-dialog').open);
    await page.locator('#desk-tab-dashboard').click();
    assert.equal(await page.locator('#save-current-view').count(),0);
    assert.equal(await page.locator('[aria-label="Refresh financial data"]').count(),0);
    await page.locator('#export-ai-btn').click();
    await page.locator('#ai-export-month').fill(new Date().toISOString().slice(0,7));
    const aiDownloadPromise=page.waitForEvent('download');
    await page.locator('#ai-export-download').click();
    const aiDownload=await aiDownloadPromise;
    assert.ok(aiDownload.suggestedFilename().startsWith('finance-ai-review-'));
    const reportText=fs.readFileSync(await aiDownload.path(),'utf8');
    assert.ok(reportText.includes('monthly_cash_flow')&&reportText.includes('current_snapshot'));
    assert.ok(!reportText.includes('preview@example.invalid'));
    await page.locator('#ai-export-dialog .dialog-close').click();
    await page.reload();await page.waitForFunction(()=>window.masterData?.length===11);
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>FinTracker.theme.set(theme),theme);
      await page.evaluate(()=>Object.values(Chart.instances).forEach(c=>{c.stop();c.update('none');}));
      await page.screenshot({path:`artifacts/step2-${theme}.png`,fullPage:true});
    }
    for(const width of [320,390,768,769,900,1440]){
      await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow ${width}`);
      if(width<=768){await page.locator('#mobile-nav [data-target="view-add"]').click();assert.ok(await page.locator('#view-add').isVisible());await page.locator('#mobile-entry-sheet .mobile-entry-close').click();await page.locator('#mobile-nav [data-target="view-dashboard"]').click();}
      const undersized=await page.locator('.action-btn,#quick-add-launch,#command-launch').evaluateAll(els=>els.filter(el=>el.getClientRects().length).filter(el=>el.getBoundingClientRect().width<44||el.getBoundingClientRect().height<44).map(el=>el.id));assert.deepEqual(undersized,[]);
      if(width===390){await page.locator('.mobile-command-tab').click();await page.locator('#command-input').fill('Add expense');await page.keyboard.press('Enter');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/step2-mobile-quick.png'});await page.keyboard.press('Escape');}
    }
    await page.setViewportSize({width:1440,height:1000});
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>FinTracker.theme.set(theme),theme);
      for(const view of ['transactions','add','config','budget']){
        await page.evaluate(view=>view==='config'?document.getElementById('config-btn').click():switchTab('view-'+view),view);
        const small=await page.locator('#view-'+view+' button').evaluateAll(els=>els.filter(el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden').filter(el=>el.getBoundingClientRect().width<43.9||el.getBoundingClientRect().height<43.9).map(el=>el.id||el.textContent.trim()));
        assert.deepEqual(small,[],`${view} targets in ${theme}`);
        await page.screenshot({path:`artifacts/step2-${theme}-${view}.png`,fullPage:true});
      }
    }
    await page.evaluate(()=>switchTab('view-dashboard'));
    const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const touch=await touchContext.newPage();touch.on('pageerror',error=>errors.push(error.message));await touch.goto(url);await touch.waitForFunction(()=>window.masterData?.length===11);
    await touch.locator('.mobile-command-tab').click();await touch.waitForSelector('#command-palette[open]');
    const sheetBounds=await touch.locator('#command-palette').boundingBox();assert.ok(Math.abs(sheetBounds.y+sheetBounds.height-844)<2,'command sheet rests at bottom');
    await touch.locator('#command-input').fill('Add expense');await touch.keyboard.press('Enter');await touch.waitForSelector('#quick-add-dialog[open]');
    await touch.keyboard.press('Escape');
    await touch.locator('#mobile-nav [data-target="view-transactions"]').click();await touch.locator('#filter-search').fill('Coffee');
    const session=await touchContext.newCDPSession(touch);
    async function swipe(dx,dy=0){await touch.locator('.mobile-swipe-track').first().scrollIntoViewIfNeeded();const row=await touch.locator('.mobile-swipe-track').first().boundingBox();const x=row.x+row.width/2,y=row.y+28;await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await swipe(96);await touch.waitForSelector('#mobile-entry-sheet[open]');assert.equal(await touch.locator('#entry-desc').inputValue(),'Coffee with friends');
    await touch.locator('#entry-desc').fill('Retained phone draft');
    await touch.setViewportSize({width:1024,height:844});await touch.waitForFunction(()=>!document.getElementById('mobile-entry-sheet').open);assert.equal(await touch.locator('#entry-desc').inputValue(),'Retained phone draft');
    await touch.setViewportSize({width:390,height:844});await touch.waitForSelector('#mobile-entry-sheet[open]');
    await touch.locator('#mobile-entry-sheet .mobile-entry-close').click();await touch.waitForFunction(()=>!document.getElementById('mobile-entry-sheet').open);
    await swipe(-96);await touch.waitForSelector('#delete-modal:not(.hidden)');assert.equal(await touch.evaluate(()=>masterData.length),11,'swipe does not delete before confirmation');
    const deletion=await touch.locator('#delete-modal>div').boundingBox();assert.ok(Math.abs(deletion.y+deletion.height-844)<2,'delete confirmation is a bottom sheet');
    await touch.screenshot({path:'artifacts/step3-mobile-delete.png'});
    await touch.locator('#del-cancel').click();await swipe(35);assert.ok(!await touch.locator('#mobile-entry-sheet').isVisible(),'short swipe cancels');
    await swipe(3,-70);assert.ok(!await touch.locator('#mobile-entry-sheet').isVisible(),'vertical gesture remains scrolling');assert.equal(await touch.evaluate(()=>masterData.length),11);
    await touch.locator('.mobile-command-tab').click();await touch.screenshot({path:'artifacts/step3-mobile-command.png'});await touch.keyboard.press('Escape');
    await touch.locator('#mobile-nav [data-target="view-dashboard"]').click();await touch.evaluate(()=>scrollTo(0,0));
    assert.equal(await touch.locator('#mobile-nav button:visible').count(),5);
    assert.ok(!await touch.locator('#quick-add-launch').isVisible());assert.ok(!await touch.locator('#ai-chat-btn').isVisible());
    const balance=await touch.locator('#wealth-display').evaluate(el=>({height:el.clientHeight,line:parseFloat(getComputedStyle(el).lineHeight),width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(balance.height<balance.line*1.5 && balance.scroll<=balance.width,'balance stays on one line');
    assert.ok(!await touch.locator('#scenario-incoming').isVisible());await touch.locator('.phone-scenario>summary').click();assert.ok(await touch.locator('#scenario-incoming').isVisible());await touch.locator('.phone-scenario>summary').click();
    for(const theme of ['light','dark']){await touch.evaluate(theme=>{FinTracker.theme.set(theme);scrollTo(0,0);},theme);await touch.screenshot({path:`artifacts/phone-refined-${theme}.png`});}
    await touch.locator('#mobile-nav [data-target="view-add"]').click();await touch.waitForSelector('#mobile-entry-sheet[open]');await touch.screenshot({path:'artifacts/phone-refined-editor.png'});await touch.locator('.mobile-entry-close').click();
    await touchContext.close();
    const pagesContext = await browser.newContext({viewport:{width:390,height:844}});
    await pagesContext.addInitScript({content: `
      const originalNetwork = window.fetch;
      ${fs.readFileSync('preview/fixtures.js','utf8')}
      window.PagesTestBackend = window.FinTrackerPreview;
      delete window.FinTrackerPreview;
      window.fetch = originalNetwork;
      window.google = {accounts:{id:{
        initialize(options) { this.options = options; },
        renderButton(container) {
          const button = document.createElement('button');
          button.textContent = 'Test Google sign-in';
          button.onclick = () => this.options.callback({credential:'browser-test-token'});
          container.append(button);
        }
      }}};
    `});
    const pages = await pagesContext.newPage();
    pages.on('pageerror',error=>errors.push(error.message));
    const requests = [];
    let denyPagesLogin = false;
    await pages.route('https://script.google.com/macros/s/**/exec', async route => {
      const payload = route.request().postDataJSON();
      requests.push(payload);
      assert.equal(payload.credential,'browser-test-token');
      const result = denyPagesLogin ? {status:'error',code:'AUTH_REQUIRED',message:'Google sign-in was rejected.'} : await pages.evaluate(payload=>PagesTestBackend.request(payload),payload);
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
    });
    await pages.goto(url.replace('preview.html','index.html'));
    await pages.getByText('Test Google sign-in',{exact:true}).waitFor();
    await pages.screenshot({path:'artifacts/pages-mobile-signin.png'});
    await pages.getByText('Test Google sign-in',{exact:true}).click();
    await pages.waitForFunction(()=>window.masterData?.length===11);
    assert.deepEqual(requests.map(request=>request.action),['getBootstrap']);
    assert.equal(await pages.evaluate(()=>FinTracker.api.isNative()),false);
    await pages.locator('#mobile-nav [data-target="view-add"]').click();
    await pages.locator('#entry-desc').fill('Pages POST check');
    await pages.locator('#entry-amt-source').fill('123');
    await pages.locator('#submit-btn').click();
    await pages.waitForFunction(()=>window.masterData?.length===12);
    assert.ok(requests.some(request=>request.action==='add'));
    await pages.screenshot({path:'artifacts/pages-mobile-connected.png'});
    denyPagesLogin = true;
    await pages.reload();
    await pages.getByText('Test Google sign-in',{exact:true}).click();
    await pages.locator('#init-loader .load-error').waitFor();
    assert.ok(await pages.locator('#init-loader').isVisible(),'rejected login displays a visible error');
    assert.equal(await pages.locator('#init-loader .load-error').textContent(),'Google sign-in was rejected.');
    denyPagesLogin = false;
    await pages.getByRole('button',{name:'Try again',exact:true}).click();
    await pages.getByText('Test Google sign-in',{exact:true}).click();
    await pages.waitForFunction(()=>window.masterData?.length===11);
    await pagesContext.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: core workflows, command search, quick-add, scenarios, themes, exports, responsive layouts, mobile gestures, and Pages sign-in/POST save/rejected-login recovery with mocked Google services.');
  }catch(error){console.error('Browser failure:',error);throw error;}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
