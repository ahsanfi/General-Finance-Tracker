(function(root){
  function mergePortfolio(original,result,rate,uuid){
    if(!Array.isArray(result.balances)||!Array.isArray(result.prices))throw Error('Invalid local sync response.');
    const next=original.map(item=>({...item})), prices=new Map(result.prices.map(item=>[item.symbol,Number(item.price)]));
    const warnings=[];
    for(const balance of result.balances){
      const asset=String(balance.asset||'').toUpperCase(), amount=Number(balance.free)+Number(balance.locked);
      if(!/^[A-Z0-9]{1,30}$/.test(asset)||!Number.isFinite(amount)||amount<0)throw Error('Invalid account balance. Portfolio was not saved.');
      const existing=next.find(item=>item.platform.toLowerCase()==='tokocrypto'&&item.name.toUpperCase()===asset);
      const usd=['USD','USDT'].includes(asset)?1:['IDR','BIDR'].includes(asset)?1/rate:prices.get(asset+'USDT')||(prices.get(asset+'BIDR')||0)/rate||(prices.get(asset+'BTC')||0)*(prices.get('BTCUSDT')||0);
      if(existing){existing.balance=amount;if(amount===0)existing.currentValue=0;else if(Number.isFinite(usd)&&usd>0)existing.currentValue=amount*usd*(existing.currency==='USD'?1:rate);else warnings.push(asset);}
      else if(amount>0&&Number.isFinite(usd)&&usd>0&&amount*usd*rate>1000)next.push({id:uuid(),name:asset,platform:'Tokocrypto',currency:'IDR',invested:0,currentValue:amount*usd*rate,balance:amount});
      else if(amount>0&&!usd)warnings.push(asset);
    }
    return {portfolio:next,warnings};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={mergePortfolio};return;}
  root.FinTracker.tokoLocal={mergePortfolio};
  let launchToken = /^#toko-local=([a-f0-9]{64})$/.exec(location.hash)?.[1];
  if(launchToken) history.replaceState(null,'',location.pathname+location.search);
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('btn-sync-toko-local');
    button.onclick=()=>openSyncDialog();
    function openSyncDialog(token){
      const dialog=document.createElement('dialog');dialog.className='workspace-dialog';dialog.setAttribute('aria-label','Local Tokocrypto sync');
      dialog.innerHTML='<div class="dialog-heading"><h2>Sync Toko locally</h2><button class="dialog-close" type="button">Close</button></div><form class="quick-form"><p>Start local-sync/toko.cjs on this computer, then paste its pairing token. Your browser may ask permission to connect to your local network.</p><label for="toko-local-token">Pairing token</label><input id="toko-local-token" type="password" autocomplete="off" required><p role="status" id="toko-local-status"></p><button class="primary-button" type="submit">Sync from this computer</button></form>';
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
      let busy=false;
      dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
      dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
      form.onsubmit=async event=>{
        event.preventDefault();if(busy)return;busy=true;submit.disabled=true;if(token)submit.hidden=true;status.textContent='Reading local account balances…';
        try{
          const [original,ledger]=await Promise.all([FinTracker.api.request('getPortfolio'),FinTracker.api.request('getData')]);
          let response;
          try{response=await fetch('http://127.0.0.1:8787/sync',{method:'POST',headers:{Authorization:'Bearer '+input.value.trim()},signal:AbortSignal.timeout(50000)});}catch(_){throw Error('Cannot reach the local helper. Start it on this computer and allow local-network access in the browser.');}
          const result=await response.json();if(!response.ok)throw Error(result.error||'Local sync failed.');
          if(!Number.isFinite(result.receivedAt)||Math.abs(Date.now()-result.receivedAt)>120000)throw Error('Local response expired. Run sync again.');
          const rate=Number(ledger.rate);
          if(!Number.isFinite(rate)||rate<=0)throw Error('The spreadsheet exchange rate is unavailable. No changes were saved.');
          const merged=mergePortfolio(original.portfolio,result,rate,()=>crypto.randomUUID());
          // Optimistic revision checking prevents overwriting edits made during the request.
          status.textContent='Saving verified balances to your spreadsheet…';
          await FinTracker.api.request('updatePortfolio',{portfolio:merged.portfolio,expectedPortfolio:original.portfolio});
          await window.refreshFinTracker();
          document.getElementById('toko-sync-notice').classList.add('hidden');
          status.textContent=merged.warnings.length?'Saved balances. Kept previous values where prices were unavailable: '+merged.warnings.join(', '):'Local sync saved to your spreadsheet.';
        }catch(error){status.textContent=error.message;submit.hidden=false;}
        finally{busy=false;form.querySelector('button').disabled=false;}
      };
      if(token)form.requestSubmit();
    }
    function startLaunch(token){
      // Wait for authenticated bootstrap so Google sign-in remains the access gate.
      FinTracker.api.bootstrap().then(()=>{
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
