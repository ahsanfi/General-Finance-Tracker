/* Installation guidance never interrupts sign-in or clears an in-progress form. */
document.addEventListener('DOMContentLoaded', () => {
  const standalone = matchMedia('(display-mode: standalone)');
  const installed = () => standalone.matches || navigator.standalone === true;
  const settings = document.getElementById('view-config');
  const card = document.createElement('section');
  card.className = 'pwa-install-card';
  card.setAttribute('aria-label', 'Install FinTracker');
  const title = document.createElement('h2');
  const description = document.createElement('p');
  const instructions = document.createElement('ol');
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const steps = apple
    ? ['Open FinTracker in Safari and tap Share (or More, then Share).', 'Choose Add to Home Screen. Keep Open as Web App enabled if shown.', 'Tap Add, then open FinTracker from its new Home Screen icon.']
    : ['Open your browser’s menu.', 'Choose Install app or Add to Home Screen, if available.'];
  for (const text of steps) { const li = document.createElement('li'); li.textContent = text; instructions.append(li); }
  const note = document.createElement('p');
  note.textContent = 'Internet is required for your financial data. You may need to sign in once when first opening the Home Screen app.';
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = 'Install FinTracker'; button.hidden = true;
  let installPrompt;
  const render = () => {
    title.textContent = installed() ? 'FinTracker is on your Home Screen' : 'Add FinTracker to your Home Screen';
    description.textContent = installed() ? 'You’re using the app view.' : 'Open your finances directly, without the browser address bar.';
    instructions.hidden = installed(); button.hidden = installed() || !installPrompt;
  };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(); });
  button.onclick = async () => {
    if (!installPrompt) return;
    button.disabled = true;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch (_) { description.textContent = 'Use the browser menu to install FinTracker.'; }
    finally { installPrompt = null; button.disabled = false; render(); }
  };
  window.addEventListener('appinstalled', render);
  standalone.addEventListener('change', render);
  card.append(title, description, instructions, button, note); settings?.prepend(card); render();

  const connection = document.createElement('div');
  connection.className = 'pwa-connection'; connection.setAttribute('role','status'); connection.hidden = true;
  document.body.append(connection);
  let timer;
  function updateConnection() {
    clearTimeout(timer);
    if (!navigator.onLine) {
      connection.textContent = 'You’re offline. Reconnect before saving. Check any interrupted save before trying again.';
      connection.hidden = false;
    } else if (!connection.hidden) {
      connection.textContent = 'Connection detected. Your open form is still here.';
      timer = setTimeout(() => { connection.hidden = true; }, 5000);
    }
  }
  window.addEventListener('online',updateConnection); window.addEventListener('offline',updateConnection); updateConnection();
  const setTheme = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = document.documentElement.dataset.theme === 'dark' ? '#080d0b' : '#ffffff';
  };
  document.addEventListener('fintracker:theme', setTheme); setTheme();
  // Scope is relative: /General-Finance-Tracker/ on Pages, never the whole origin.
  if ('serviceWorker' in navigator && window.isSecureContext && !window.FinTrackerPreview && !window.google?.script?.run && !location.hostname.endsWith('googleusercontent.com')) {
    navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'}).catch(() => {
      // Installation still works without offline support; leave the online app usable.
    });
  }
});
