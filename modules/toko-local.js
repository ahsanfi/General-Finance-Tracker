(function(root){
  function mergePortfolio(original,result,rate,uuid){
    if(!Array.isArray(result.balances)||!Array.isArray(result.prices))throw Error('Invalid local sync response.');
    const next=original.map(item=>({...item})), prices=new Map(result.prices.map(item=>[item.symbol,Number(item.price)]));
    const warnings=[];
    let validBalances=0;
    for(const [index,balance] of result.balances.entries()){
      const asset=String(balance?.asset||'').trim().toUpperCase();
      const validAsset=/^[A-Z0-9]{1,30}$/.test(asset);
      const quantity=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))&&Number(value)>=0;
      // Do not turn missing or malformed quantities into zero and erase a saved holding.
      // An unrelated bad row must not prevent valid holdings from synchronizing.
      if(!validAsset||!quantity(balance?.free)||!quantity(balance?.locked)||!Number.isFinite(Number(balance.free)+Number(balance.locked))){
        warnings.push(`${validAsset?asset:'Account row '+(index+1)} (invalid or missing balance; skipped)`);
        continue;
      }
      const amount=Number(balance.free)+Number(balance.locked);
      validBalances++;
      const existing=next.find(item=>item.platform.toLowerCase()==='tokocrypto'&&item.name.toUpperCase()===asset);
      const usd=['USD','USDT'].includes(asset)?1:['IDR','BIDR'].includes(asset)?1/rate:prices.get(asset+'USDT')||(prices.get(asset+'BIDR')||0)/rate||(prices.get(asset+'BTC')||0)*(prices.get('BTCUSDT')||0);
      if(existing){existing.balance=amount;if(amount===0)existing.currentValue=0;else if(Number.isFinite(usd)&&usd>0)existing.currentValue=amount*usd*(existing.currency==='USD'?1:rate);else warnings.push(asset);}
      else if(amount>0&&Number.isFinite(usd)&&usd>0&&amount*usd*rate>1000)next.push({id:uuid(),name:asset,platform:'Tokocrypto',currency:'IDR',invested:0,currentValue:amount*usd*rate,balance:amount});
      else if(amount>0&&!usd)warnings.push(asset);
    }
    if(result.balances.length&&!validBalances)throw Error('No usable account balances were returned. Portfolio was not saved. '+warnings.join(', '));
    return {portfolio:next,warnings};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={mergePortfolio};return;}
  root.FinTracker.tokoLocal={mergePortfolio};
  let launchToken = /^#toko-local=([a-f0-9]{64})$/.exec(location.hash)?.[1];
  if(launchToken) history.replaceState(null,'',location.pathname+location.search);
  // Reopening sync in this tab reuses its pairing until the helper rejects it.
  let pairedToken=null;
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('btn-sync-toko-local');
    button.onclick=()=>openSyncDialog(pairedToken);
    function openSyncDialog(token){
      const dialog=document.createElement('dialog');dialog.className='workspace-dialog';dialog.setAttribute('aria-label','Local Tokocrypto sync');
      dialog.innerHTML='<div class="dialog-heading"><h2>Sync Toko locally</h2><button class="dialog-close" type="button">Close</button></div><form class="quick-form"><p>Double-click Start_Toko_Sync.bat on this computer and use the page it opens. Pairing and sync start automatically. The field below is only for manual terminal setup; it is not your API key.</p><label for="toko-local-token">Manual pairing token</label><input id="toko-local-token" type="password" autocomplete="off" required><p role="status" id="toko-local-status"></p><button class="primary-button" type="submit">Sync from this computer</button></form>';
      dialog.querySelector('.dialog-close').onclick=()=>{if(!busy)dialog.close();};
      const input=dialog.querySelector('input'),status=dialog.querySelector('[role="status"]'),form=dialog.querySelector('form');
      const submit=form.querySelector('button');
      // The BAT has already paired this browser. Only manual launches need a token field.
      if(token){
        input.type='hidden';input.value=token;
        form.querySelector('label').hidden=true;
        form.querySelector('p').textContent='Connected through the local launcher. Keep its window open until sync finishes.';
        submit.hidden=true;submit.textContent='Retry sync';
      }
      let busy=false,needsReconnect=false;
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
      form.onsubmit=async event=>{
        event.preventDefault();if(busy)return;busy=true;submit.disabled=true;if(token)submit.hidden=true;status.textContent='Reading local account balances…';
        try{
          const [original,ledger]=await Promise.all([FinTracker.api.request('getPortfolio'),FinTracker.api.request('getData')]);
          let response;
          try{response=await fetch('http://127.0.0.1:8787/sync',{method:'POST',headers:{Authorization:'Bearer '+input.value.trim()},signal:AbortSignal.timeout(50000)});}catch(_){throw Error('Cannot reach the local helper. Start it on this computer and allow local-network access in the browser.');}
          if(response.status===401){
            pairedToken=null;
            needsReconnect=true;
            throw Error('This page is not paired with the running helper. Close the Toko helper window, double-click Start_Toko_Sync.bat, and use the page it opens. No API key or code needs to be pasted.');
          }
          const result=await response.json();if(!response.ok)throw Error(result.error||'Local sync failed.');
          pairedToken=input.value.trim();
          if(!Number.isFinite(result.receivedAt)||Math.abs(Date.now()-result.receivedAt)>120000)throw Error('Local response expired. Run sync again.');
          const rate=Number(ledger.rate);
          if(!Number.isFinite(rate)||rate<=0)throw Error('The spreadsheet exchange rate is unavailable. No changes were saved.');
          const merged=mergePortfolio(original.portfolio,result,rate,()=>crypto.randomUUID());
          // Optimistic revision checking prevents overwriting edits made during the request.
          status.textContent='Saving verified balances to your spreadsheet…';
          await FinTracker.api.request('updatePortfolio',{portfolio:merged.portfolio,expectedPortfolio:original.portfolio,syncPlatforms:['Tokocrypto']});
          await window.refreshFinTracker();
          document.getElementById('toko-sync-notice').classList.add('hidden');
          status.textContent=merged.warnings.length?'Saved valid balances. Existing holdings were retained for skipped balances or unavailable prices: '+merged.warnings.join(', '):'Local sync saved to your spreadsheet.';
        }catch(error){status.textContent=error.message;submit.hidden=needsReconnect;}
        finally{busy=false;form.querySelector('button').disabled=false;}
      };
      if(token)form.requestSubmit();
    }
    function startLaunch(token){
      // Wait for authenticated bootstrap so Google sign-in remains the access gate.
      FinTracker.api.bootstrap().then(()=>{
        pairedToken=token;
        openSyncDialog(token);
      }).catch(()=>{ /* The existing login/retry screen reports bootstrap failures. */ });
    }
    if(launchToken){const token=launchToken;launchToken=null;startLaunch(token);}
    // Browsers can reuse an already-open app tab instead of loading a new document.
    window.addEventListener('hashchange',()=>{
      const token=/^#toko-local=([a-f0-9]{64})$/.exec(location.hash)?.[1];
      if(!token)return;
      history.replaceState(null,'',location.pathname+location.search);
      startLaunch(token);
    });
  });
})(globalThis);
