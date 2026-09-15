/* Read-only recovery when Google's ContentService redirect cannot be retrieved. */
window.FinTracker = window.FinTracker || {};
FinTracker.readBridge = (url, payload) => new Promise((resolve, reject) => {
  const actions = ['getBootstrap', 'getData', 'getSystemConfig', 'getBudgets', 'getPortfolio'];
  if (!actions.includes(payload.action) || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    reject(new Error('Unsupported recovery request.'));
    return;
  }
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  const frame = document.createElement('iframe');
  frame.name = 'ft_read_' + nonce;
  frame.hidden = true;
  frame.title = 'Financial data connection';
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = frame.name;
  form.hidden = true;
  // Credentials stay in the POST body, never URLs, storage, or diagnostic messages.
  const field = document.createElement('input');
  field.type = 'hidden';
  field.name = 'ftReadBridge';
  field.value = JSON.stringify({nonce, origin: location.origin, payload});
  form.append(field);
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener('message', receive);
    form.remove();
    frame.remove();
  };
  const receive = event => {
    // HTMLService runs in Google's nested sandbox, so the sender is not the outer iframe.
    const trusted = /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin);
    if (!trusted || event.data?.type !== 'fintracker-read' || event.data.nonce !== nonce) return;
    cleanup();
    resolve(event.data.result);
  };
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error('The recovery connection did not respond. Make sure the updated code.gs is deployed, then try again.'));
  }, 15000);
  window.addEventListener('message', receive);
  try {
    document.body.append(frame, form);
    form.submit();
  } catch (error) {
    cleanup();
    reject(new Error('Could not open the recovery connection. Try again.'));
  }
});
