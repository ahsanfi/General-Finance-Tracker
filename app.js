document.addEventListener('DOMContentLoaded', () => {
            const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzt2el5OeYDohIdAKM3x_GEdth5XroKsOkSALeJi3UfM6u8_C8oUiC26epdw2lMoNEVJw/exec";

            let SYSTEM_CONFIG = { exp: [], inc: [], walletsIDR: [], walletsUSD: [], pin: null };
            let masterData = [], itemToDelete = null, sortState = { k: 'date', o: 'desc' }, calendarDate = new Date(), exchangeRate = 16000;
            window.masterData = masterData; // exposed for AI assistant
            window.exchangeRate = exchangeRate;
            let isEditing = false, editItem = null;
            window.isBalancesHidden = localStorage.getItem('hideBalances') === 'true';

            document.getElementById('entry-date').valueAsDate = new Date();
            loadSystemConfig();

            // ── Calculator (dual-mode: custom keypad on mobile, keyboard on desktop) ─
            const CALC_IDS = ['entry-amt-source', 'entry-amt-target', 'budget-amount-input', 'portfolio-invested', 'portfolio-value', 'trade-amount', 'trade-new-value'];
            const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

            // ── Shared evaluator ──────────────────────────────────────────────
            function calcEval(expr) {
                const clean = expr.trim();
                if (!clean || !/^[\d\s\+\-\*\/\(\)\.]+$/.test(clean)) return null;
                try {
                    // eslint-disable-next-line no-new-func
                    const r = Function('"use strict"; return (' + clean + ')')();
                    return (isFinite(r) && r >= 0) ? Math.round(r * 100) / 100 : null;
                } catch (e) { return null; }
            }

            function flashResult(el, result) {
                el.value = result;
                el.style.color = '#34d399';
                setTimeout(() => { el.style.color = ''; }, 1500);
            }

            // ── Desktop: type "10+60=" to auto-calculate ──────────────────────
            function attachDesktopCalc(el) {
                if (!el) return;
                let t = null;
                el.addEventListener('input', function () {
                    const raw = this.value;
                    if (!raw.endsWith('=')) return;
                    const expr = raw.slice(0, -1);
                    const result = calcEval(expr);
                    if (result === null) return;
                    this.value = expr + ' = ' + result.toLocaleString('id-ID');
                    this.style.color = '#34d399';
                    clearTimeout(t);
                    t = setTimeout(() => { this.value = result; this.style.color = ''; }, 1500);
                });
            }

            // ── Mobile: custom keypad ─────────────────────────────────────────
            const keypad  = document.getElementById('calc-keypad');
            const exprEl  = document.getElementById('calc-expr');
            const doneBtn = document.getElementById('calc-done');
            const clearBtn = document.getElementById('calc-clear');
            let activeEl  = null;
            let expr      = '';

            function kpShow(inputEl) {
                activeEl = inputEl;
                // Seed expression from current value (numbers only)
                const cur = (inputEl.value || '').trim();
                expr = /^[\d\+\-\*\/\.\s]+$/.test(cur) ? cur : '';
                exprEl.textContent = expr || '0';
                keypad.style.display = 'block';
                document.body.style.paddingBottom = '320px'; // Make room for keypad
                requestAnimationFrame(() => { keypad.style.transform = 'translateY(0)'; });
                // Scroll the input into view above the keypad
                setTimeout(() => inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 260);
            }

            function kpHide() {
                keypad.style.transform = 'translateY(100%)';
                document.body.style.paddingBottom = ''; // Remove padding
                setTimeout(() => { keypad.style.display = 'none'; }, 260);
                activeEl = null;
            }

            function kpCommit(doClose) {
                if (!activeEl) return;
                const result = calcEval(expr);
                if (result !== null) flashResult(activeEl, result);
                else if (expr) activeEl.value = expr;
                if (doClose) kpHide();
            }

            if (isTouchDevice && keypad) {
                // Suppress native keyboard on amount inputs
                CALC_IDS.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.setAttribute('inputmode', 'none');
                    el.setAttribute('autocomplete', 'off');
                    el.addEventListener('focus', () => kpShow(el));
                    el.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        el.focus();
                        kpShow(el);
                    }, { passive: false });
                });

                // Keypad button handler
                keypad.querySelectorAll('[data-k]').forEach(btn => {
                    btn.addEventListener('touchstart', (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (!activeEl) return;
                        const k = btn.dataset.k;
                        if (k === '⌫') {
                            expr = expr.slice(0, -1);
                        } else {
                            expr += k;
                        }
                        // Auto-evaluate and show result preview
                        const result = calcEval(expr);
                        exprEl.textContent = result !== null && expr.match(/[\+\-\*\/]/) 
                            ? expr + ' = ' + result.toLocaleString('id-ID') 
                            : (expr || '0');
                        activeEl.value = expr;
                    }, { passive: false });
                });

                // Done button
                doneBtn && doneBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    kpCommit(true);
                }, { passive: false });

                // Clear button
                clearBtn && clearBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (!activeEl) return;
                    expr = '';
                    exprEl.textContent = '0';
                    activeEl.value = '';
                }, { passive: false });

                // Tap outside keypad to close
                document.addEventListener('touchstart', (e) => {
                    if (!activeEl) return;
                    if (!keypad.contains(e.target) && !CALC_IDS.includes(e.target.id)) {
                        kpCommit(true);
                    }
                }, { passive: true });

            } else {
                // Desktop: keyboard typing calculator
                CALC_IDS.forEach(id => attachDesktopCalc(document.getElementById(id)));
            }

            // ── Helper: read numeric amount from a field ──────────────────────
            function readAmt(id) {
                const val = (document.getElementById(id)?.value || '').trim();
                if (val.includes(' = ')) return Math.abs(parseFloat(val.split(' = ').pop().replace(/\./g, '').replace(',', '.')));
                if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(val)) {
                    try { return Math.abs(Function('"use strict"; return (' + val + ')')()) || 0; } catch (e) {}
                }
                return Math.abs(parseFloat(val.replace(/\./g, '').replace(',', '.'))) || 0;
            }
            // ─────────────────────────────────────────────────────────────────



            async function loadSystemConfig() {
                // Safety: always hide the loader after 8s so it never permanently blocks the UI
                const loaderEl = document.getElementById('init-loader');
                const loaderTimeout = setTimeout(() => loaderEl.classList.add('hidden'), 8000);
                try {
                    const response = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getSystemConfig' }) });
                    const result = await response.json();
                    if (result.status === 'success') {
                        SYSTEM_CONFIG = result;
                        updateWalletOptions('IDR', 'entry-acc-source');
                        updateWalletOptions('IDR', 'entry-acc-target');
                        updateCategoryOptions('expense');
                        clearTimeout(loaderTimeout);
                        loaderEl.classList.add('hidden');
                        checkAuth();
                    } else throw new Error('Failed');
                } catch (e) {
                    clearTimeout(loaderTimeout);
                    loaderEl.innerHTML = '<p class="text-rose-400 font-medium">Connection Failed. Please refresh.</p>';
                }
            }

            function updateWalletOptions(currency, selectId) {
                const sel = document.getElementById(selectId);
                const list = currency === 'USD' ? SYSTEM_CONFIG.walletsUSD : SYSTEM_CONFIG.walletsIDR;
                const safeList = (list && list.length > 0) ? list : ["General"];
                sel.innerHTML = safeList.map(w => `<option value="${w}">${w}</option>`).join('');
            }

            document.getElementById('entry-curr-source').addEventListener('change', (e) => updateWalletOptions(e.target.value, 'entry-acc-source'));
            document.getElementById('entry-curr-target').addEventListener('change', (e) => updateWalletOptions(e.target.value, 'entry-acc-target'));

            function handleUrlParams() {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('scanBase64')) {
                    setTimeout(() => {
                        updateTabUI('view-add');
                        try {
                            const base64 = urlParams.get('scanBase64').replace(/ /g, '+');
                            const byteCharacters = atob(base64);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], {type: 'image/jpeg'});
                            
                            const key = scanProvider === 'groq'
                                ? localStorage.getItem('groqApiKey')
                                : localStorage.getItem('mtracker_minimax_key');
                            if (!key) {
                                const label = scanProvider === 'groq' ? 'Groq' : 'MiniMax';
                                showToast(`Please save your ${label} API Key in Config first`, 'error');
                                window.switchTab('view-config');
                            } else {
                                processReceiptImage(blob);
                            }
                        } catch(e) {
                            showToast("Failed to read image from URL", 'error');
                            console.error(e);
                        }
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }, 500);
                } else if (urlParams.has('amount') || urlParams.has('desc')) {
                    setTimeout(() => {
                        updateTabUI('view-add');

                        if (urlParams.has('amount')) document.getElementById('entry-amt-source').value = urlParams.get('amount');
                        if (urlParams.has('desc')) document.getElementById('entry-desc').value = urlParams.get('desc');
                        if (urlParams.has('date')) document.getElementById('entry-date').value = urlParams.get('date');

                        if (urlParams.has('cat')) {
                            const cat = urlParams.get('cat');
                            const catSelect = document.getElementById('entry-cat');
                            if ([...catSelect.options].map(o => o.value).includes(cat)) {
                                catSelect.value = cat;
                                document.getElementById('entry-cat-other').classList.add('hidden');
                            } else {
                                catSelect.value = 'Other';
                                document.getElementById('entry-cat-other').classList.remove('hidden');
                                document.getElementById('entry-cat-other').style.display = 'block';
                                document.getElementById('entry-cat-other').value = cat;
                            }
                        }

                        showToast("Receipt data imported!", "success");
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }, 500);
                }
            }

            // --- GOOGLE AUTH LOGIC ---
            window.handleGoogleSignIn = function (response) {
                const payload = JSON.parse(atob(response.credential.split('.')[1]));
                const email = payload.email;
                const allowed = SYSTEM_CONFIG.allowedEmails || [];
                if (allowed.length === 0 || allowed.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
                    sessionStorage.setItem('auth', JSON.stringify({ email, name: payload.name, picture: payload.picture }));
                    document.getElementById('pin-modal').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.getElementById('mobile-nav').classList.remove('hidden');
                    document.getElementById('ai-chat-btn').classList.remove('hidden');
                    fetchData();
                    loadBudgetsFromSheets();
                    handleUrlParams();
                } else {
                    document.getElementById('pin-error').textContent = `Access denied for ${email}. Contact the app owner.`;
                }
            };

            function checkAuth() {
                if (sessionStorage.getItem('auth')) {
                    document.getElementById('pin-modal').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.getElementById('mobile-nav').classList.remove('hidden');
                    document.getElementById('ai-chat-btn').classList.remove('hidden');
                    fetchData();
                    loadBudgetsFromSheets();
                    handleUrlParams();
                } else {
                    document.getElementById('pin-modal').classList.remove('hidden');
                }
            }

            document.getElementById('logout-btn').addEventListener('click', () => {
                sessionStorage.removeItem('auth');
                google.accounts.id.revoke(JSON.parse(sessionStorage.getItem('auth') || '{}').email || '', () => { });
                location.reload();
            });

            // Tab Navigation Logic
            const deskNavBtns = document.querySelectorAll('.desk-nav-btn');
            const mobNavBtns = document.querySelectorAll('.mob-nav-btn');

            function updateTabUI(viewId) {
                // Hide all views
                document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
                document.getElementById(viewId).classList.remove('hidden');

                // Update Desktop Nav
                deskNavBtns.forEach(btn => {
                    if (btn.dataset.target === viewId) {
                        btn.classList.add('desk-nav-active');
                        btn.classList.remove('text-slate-400');
                    } else {
                        btn.classList.remove('desk-nav-active');
                        btn.classList.add('text-slate-400');
                    }
                });

                // Update Mobile Nav
                mobNavBtns.forEach(btn => {
                    if (btn.dataset.target === viewId) {
                        btn.classList.add('mob-nav-active');
                        btn.classList.remove('text-slate-500');
                    } else {
                        btn.classList.remove('mob-nav-active');
                        btn.classList.add('text-slate-500');
                    }
                });
            }

            deskNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
            mobNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));

            // Expose switchTab globally for edit buttons
            window.switchTab = updateTabUI;

            // --- Daily / Calendar / Monthly Sub-tab logic ---
            function setDailySubTab(tab) {
                const isDaily = tab === 'daily';
                const isCal = tab === 'calendar';
                const isMonthly = tab === 'monthly';

                document.getElementById('subtab-daily-content').classList.toggle('hidden', !isDaily);
                document.getElementById('subtab-calendar-content').classList.toggle('hidden', !isCal);
                document.getElementById('subtab-monthly-content').classList.toggle('hidden', !isMonthly);

                const dailyBtn = document.getElementById('subtab-daily-btn');
                const calBtn = document.getElementById('subtab-calendar-btn');
                const monthlyBtn = document.getElementById('subtab-monthly-btn');

                const activeClass = 'flex-1 py-2 text-xs font-bold rounded-xl bg-theme-primary/20 text-theme-primaryLight border border-theme-primary/30 transition';
                const inactiveClass = 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-300 transition';

                dailyBtn.className = isDaily ? activeClass : inactiveClass;
                calBtn.className = isCal ? activeClass : inactiveClass;
                monthlyBtn.className = isMonthly ? activeClass : inactiveClass;

                if (isCal) renderCalendar(masterData);
            }

            document.getElementById('subtab-daily-btn').addEventListener('click', () => setDailySubTab('daily'));
            document.getElementById('subtab-calendar-btn').addEventListener('click', () => setDailySubTab('calendar'));
            document.getElementById('subtab-monthly-btn').addEventListener('click', () => setDailySubTab('monthly'));

            // --- Budget / Investments Sub-tab logic ---
            function setBudgetSubTab(tab) {
                const isBudget = tab === 'budget';
                
                document.getElementById('subtab-budget-content').classList.toggle('hidden', !isBudget);
                document.getElementById('subtab-investments-content').classList.toggle('hidden', isBudget);

                const budgetBtn = document.getElementById('subtab-budget-btn');
                const investBtn = document.getElementById('subtab-investments-btn');

                const activeClass = 'flex-1 py-2 text-xs font-bold rounded-xl bg-theme-primary/20 text-theme-primaryLight border border-theme-primary/30 transition';
                const inactiveClass = 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-300 transition';

                budgetBtn.className = isBudget ? activeClass : inactiveClass;
                investBtn.className = !isBudget ? activeClass : inactiveClass;
            }

            document.getElementById('subtab-budget-btn').addEventListener('click', () => setBudgetSubTab('budget'));
            document.getElementById('subtab-investments-btn').addEventListener('click', () => setBudgetSubTab('investments'));

            window.applyDatePreset = (type) => {
                const now = new Date();
                let start, end;
                if (type === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
                else if (type === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
                else if (type === 'last30') { end = new Date(); start = new Date(); start.setDate(now.getDate() - 30); }
                else if (type === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
                else { document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; renderAll(); document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); return; }
                document.getElementById('filter-start').value = start.toISOString().split('T')[0]; document.getElementById('filter-end').value = end.toISOString().split('T')[0]; renderAll();
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); if (event) event.target.classList.add('preset-active');
            };

            function updateCategoryOptions(type) {
                const sel = document.getElementById('entry-cat'); sel.innerHTML = '';
                let options = type === 'income' ? SYSTEM_CONFIG.inc : SYSTEM_CONFIG.exp;
                if (!options || options.length === 0) options = ["General"];
                options.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o); });
                const otherOpt = document.createElement('option'); otherOpt.value = 'Other'; otherOpt.textContent = 'Other...'; sel.appendChild(otherOpt);
                document.getElementById('entry-cat-other').classList.add('hidden');
            }

            const typeRadios = document.getElementsByName('entry-type');
            const segmentIndicator = document.getElementById('segment-indicator');

            function updateSegmentIndicator(val) {
                if (val === 'expense') { segmentIndicator.style.transform = 'translateX(0%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-rose-500/20 bg-rose-500/10 w-[calc(33.33%-4px)]"; }
                else if (val === 'income') { segmentIndicator.style.transform = 'translateX(100%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-emerald-500/20 bg-emerald-500/10 w-[calc(33.33%-4px)]"; }
                else if (val === 'transfer') { segmentIndicator.style.transform = 'translateX(200%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-blue-500/20 bg-blue-500/10 w-[calc(33.33%-4px)]"; }
            }

            typeRadios.forEach(r => r.addEventListener('change', () => {
                const val = document.querySelector('input[name="entry-type"]:checked').value;
                updateSegmentIndicator(val);
                updateUIForType(val);
            }));

            function updateUIForType(val) {
                const tg = document.getElementById('transfer-target-group'), cg = document.getElementById('category-group'), ls = document.getElementById('lbl-source-acc'), btn = document.getElementById('submit-btn');
                if (val === 'transfer') {
                    tg.classList.remove('hidden'); cg.classList.add('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / SOURCE';
                    btn.innerHTML = `<span>${isEditing ? "Update Transfer" : "Process Transfer"}</span> <i class="fas fa-exchange-alt"></i>`;
                    btn.className = "w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                } else {
                    tg.classList.add('hidden'); cg.classList.remove('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / ACCOUNT';
                    btn.innerHTML = `<span>${isEditing ? "Update Transaction" : "Save Transaction"}</span> <i class="fas fa-check"></i>`;
                    updateCategoryOptions(val);
                    if (val === 'income') btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                    else btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                }
            }
            document.getElementById('entry-cat').addEventListener('change', e => document.getElementById('entry-cat-other').classList.toggle('hidden', e.target.value !== 'Other'));

            async function fetchData() {
                try {
                    const response = await fetch(WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'getData' })
                    });
                    const result = await response.json();

                    if (result.status !== 'success') throw new Error(result.message || "Failed to load");

                    masterData = [];
                    window.portfolioData = result.portfolio || [];
                    exchangeRate = result.rate || 16000;

                    const parse = (rows, type) => {
                        if (!rows || rows.length < 2) return;
                        for (let i = 1; i < rows.length; i++) {
                            const r = rows[i];
                            if (!r[0]) continue;
                            let dateStr = typeof r[0] === 'string' ? r[0].split('T')[0] : r[0];
                            let amt = typeof r[5] === 'string' ? parseFloat(r[5].replace(/,/g, '')) : r[5];
                            masterData.push({ type, date: dateStr, desc: r[1], cat: r[2], acc: r[3], curr: r[4], amt: Math.abs(amt || 0) });
                        }
                    };

                    parse(result.income, 'income');
                    parse(result.expenses, 'expense');

                    const cats = [...new Set(masterData.map(d => d.cat))].sort(), accs = [...new Set(masterData.map(d => d.acc))].sort();
                    document.getElementById('filter-cat').innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option>${c}</option>`).join('');
                    document.getElementById('filter-acc').innerHTML = '<option value="all">All Accounts</option>' + accs.map(a => `<option>${a}</option>`).join('');
                    renderAll();
                    window.masterData = masterData;     // keep AI context in sync
                    window.exchangeRate = exchangeRate;
                } catch (e) { showToast("Error loading data: " + e.message, 'error'); }
            }


            function renderAll() {
                const bals = {}; let incIDR = 0, expIDR = 0, incUSD = 0, expUSD = 0;
                masterData.forEach(d => {
                    const k = `${d.acc}-${d.curr}`;
                    if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
                    if (d.type === 'income') {
                        bals[k].v += d.amt;
                        if (d.cat !== 'Transfer' && d.cat !== 'Initial Balance') { if (d.curr === 'IDR') incIDR += d.amt; else incUSD += d.amt; }
                    } else {
                        bals[k].v -= d.amt;
                        if (d.cat !== 'Transfer') { if (d.curr === 'IDR') expIDR += d.amt; else expUSD += d.amt; }
                    }
                });

                const invAccs = SYSTEM_CONFIG.investmentAccounts || [];
                let totalPortfolioPnlIDR = 0;

                document.getElementById('account-balances-container').innerHTML = Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).map((b, idx) => {
                    const isUSD = b.c === 'USD';
                    const id = `bal-${idx}`;
                    
                    let displayVal = b.v;
                    let isInv = invAccs.includes(b.n);
                    
                    if (isInv) {
                        let investedBase = 0;
                        let marketBase = 0;
                        (window.portfolioData || []).forEach(a => {
                            if (a.platform === b.n) {
                                const aInvBase = (a.currency === b.c) ? a.invested : (a.currency === 'IDR' && b.c === 'USD' ? a.invested / exchangeRate : a.invested * exchangeRate);
                                const aValBase = (a.currency === b.c) ? a.currentValue : (a.currency === 'IDR' && b.c === 'USD' ? a.currentValue / exchangeRate : a.currentValue * exchangeRate);
                                investedBase += aInvBase;
                                marketBase += aValBase;
                            }
                        });
                        const pnlBase = marketBase - investedBase;
                        displayVal = b.v + pnlBase;
                        
                        // Add to total global PnL
                        totalPortfolioPnlIDR += (b.c === 'IDR' ? pnlBase : pnlBase * exchangeRate);
                    }

                    return `
                    <div class="bg-black/30 p-4 rounded-2xl border ${isInv ? 'border-purple-500/30' : 'border-white/5'} hover:border-white/10 transition flex flex-col justify-center min-h-[80px] relative group shadow-inner">
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest truncate mb-1 flex items-center gap-1" title="${b.n}">
                            ${isInv ? '<i class="fas fa-layer-group text-purple-400"></i>' : ''} ${b.n}
                        </span>
                        <span id="${id}" class="font-bold font-mono text-sm tracking-tighter truncate ${displayVal >= 0 ? (isInv ? 'text-purple-400' : 'text-theme-primaryLight') : 'text-rose-400'} ${isUSD ? 'cursor-pointer' : ''}" onclick="${isUSD ? `toggleCurrency('${id}', ${displayVal})` : ''}">
                            ${fmt(displayVal, b.c)}
                        </span>
                        ${isUSD ? '<div class="absolute top-2 right-2 text-[8px] bg-white/5 p-1 rounded text-slate-500 group-hover:text-theme-primaryLight transition"><i class="fas fa-exchange-alt"></i></div>' : ''}
                    </div>
                `;
                }).join('');

                const totalIncReal = incIDR + (incUSD * exchangeRate);
                const totalExpReal = expIDR + (expUSD * exchangeRate);
                const netCashFlowIDR = totalIncReal - totalExpReal;
                let totalAssetIDR = totalPortfolioPnlIDR; 
                Object.values(bals).forEach(b => { if (b.c === 'IDR') totalAssetIDR += b.v; if (b.c === 'USD') totalAssetIDR += (b.v * exchangeRate); });

                const dashboardValueClass = 'stat-value amount-text text-[13px] min-[390px]:text-[14px] sm:text-base md:text-xl xl:text-2xl leading-tight whitespace-normal break-words font-bold z-10 font-mono';
                const incomeEl = document.querySelector('#summary-income .stat-value');
                const expenseEl = document.querySelector('#summary-expense .stat-value');
                const netEl = document.querySelector('#summary-net .stat-value');
                const wealthEl = document.getElementById('wealth-display');

                incomeEl.textContent = fmt(totalIncReal, 'IDR');
                incomeEl.className = `${dashboardValueClass} text-emerald-400 text-shadow-sm`;
                expenseEl.textContent = fmt(totalExpReal, 'IDR');
                expenseEl.className = `${dashboardValueClass} text-rose-400`;
                netEl.textContent = fmt(netCashFlowIDR, 'IDR');
                netEl.className = `${dashboardValueClass} ${netCashFlowIDR >= 0 ? 'text-slate-200' : 'text-rose-400'}`;

                document.getElementById('rate-display').textContent = `1 USD = ${fmt(exchangeRate, 'IDR').replace('IDR', '').trim()}`;
                wealthEl.textContent = window.isBalancesHidden ? '***' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalAssetIDR);
                wealthEl.className = `${dashboardValueClass} text-white mt-auto`;

                const s = document.getElementById('filter-search').value.toLowerCase(), start = document.getElementById('filter-start').value, end = document.getElementById('filter-end').value, fCat = document.getElementById('filter-cat').value, fAcc = document.getElementById('filter-acc').value;
                let filtered = masterData.filter(d => {
                    if (start && d.date < start) return false; if (end && d.date > end) return false;
                    if (fCat !== 'all' && d.cat !== fCat) return false; if (fAcc !== 'all' && d.acc !== fAcc) return false;
                    if (s && !d.desc.toLowerCase().includes(s)) return false; return true;
                }).sort((a, b) => sortState.o === 'asc' ? (a[sortState.k] > b[sortState.k] ? 1 : -1) : (a[sortState.k] < b[sortState.k] ? 1 : -1));

                const toDataAttr = (item) => String(JSON.stringify(item))
                    .replace(/&/g, '&amp;')
                    .replace(/'/g, '&#39;')
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                const isCompactList = window.matchMedia('(max-width: 1023px)').matches;
                const mobileFiltered = isCompactList ? filtered.slice(0, 80) : filtered;
                document.getElementById('mobile-trans-list').innerHTML = mobileFiltered.map(d => `
                <div class="glass p-4 rounded-2xl flex justify-between items-center active:scale-[0.98] transition-transform">
                    <div class="flex flex-col max-w-[60%] space-y-1.5">
                        <span class="text-sm font-bold text-slate-100 truncate">${d.desc}</span>
                        <div class="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400">
                            <span class="bg-black/30 px-2 py-1 rounded-md border border-white/5">${d.date.slice(5)}</span>
                            <span class="bg-theme-primary/10 text-theme-primaryLight px-2 py-1 rounded-md border border-theme-primary/20 uppercase tracking-wider">${d.acc}</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="font-bold font-mono text-sm ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</span>
                        <div class="flex gap-2">
                            <button class="bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition edit-btn" data-item='${toDataAttr(d)}'><i class="fas fa-pen text-xs"></i></button>
                            <button class="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition del-btn" data-item='${toDataAttr(d)}'><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                </div>
            `).join('') + (isCompactList && filtered.length > mobileFiltered.length ? `<div class="text-center text-slate-500 py-3 text-xs font-medium">Showing latest ${mobileFiltered.length} of ${filtered.length} transactions. Use filters to narrow the list.</div>` : '');
                if (filtered.length === 0) document.getElementById('mobile-trans-list').innerHTML = '<div class="text-center text-slate-500 py-10 text-sm italic glass rounded-2xl">No transactions found</div>';

                if (!isCompactList) {
                    document.getElementById('data-body').innerHTML = filtered.map(d => `
                <tr class="hover:bg-white/5 transition border-b border-white/5 last:border-0 group">
                    <td class="px-6 py-4 text-sm text-slate-400 whitespace-nowrap font-mono">${d.date}</td>
                    <td class="px-6 py-4 text-sm text-slate-200 font-medium">${d.desc}</td>
                    <td class="px-6 py-4 text-sm"><span class="bg-theme-primary/10 text-theme-primaryLight border border-theme-primary/20 px-2.5 py-1 rounded-lg text-xs font-medium">${d.acc}</span></td>
                    <td class="px-6 py-4 text-sm text-slate-400"><span class="bg-black/30 border border-white/5 px-2.5 py-1 rounded-lg text-xs">${d.cat}</span></td>
                    <td class="px-6 py-4 text-sm text-right font-mono font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</td>
                    <td class="px-4 py-4 text-center">
                        <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button class="w-8 h-8 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition edit-btn" data-item='${toDataAttr(d)}'><i class="fas fa-pen text-xs"></i></button>
                            <button class="w-8 h-8 bg-rose-500/10 rounded-lg text-rose-400 hover:bg-rose-500/20 transition del-btn" data-item='${toDataAttr(d)}'><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
                    if (filtered.length === 0) document.getElementById('data-body').innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500 text-sm italic">No data found</td></tr>';
                }

                renderDaily(masterData); renderCalendar(masterData); renderMonthlyOverview(masterData); updateChart(masterData); updateTrendChart(masterData); renderDashWidgets(masterData); renderInvestments(bals);
            }

            let portfolioChart = null;

            function renderInvestments(bals) {
                const invAccs = SYSTEM_CONFIG.investmentAccounts || [];
                let totalCashIDR = 0;
                let html = '';

                if (invAccs.length === 0) {
                    html = '<div class="text-center py-10 text-slate-500 text-sm italic glass rounded-2xl">No investment accounts configured. Manage them in Config.</div>';
                } else {
                    const invBals = Object.values(bals).filter(b => invAccs.includes(b.n)).sort((a, b) => a.n.localeCompare(b.n));
                    if (invBals.length === 0) {
                        html = '<div class="text-center py-10 text-slate-500 text-sm italic glass rounded-2xl">No cash data for configured investment accounts.</div>';
                    } else {
                        html = invBals.map(b => {
                            const valIDR = b.c === 'IDR' ? b.v : (b.v * exchangeRate);
                            totalCashIDR += valIDR;
                            
                            let investedInThisPlatformIDR = 0;
                            (window.portfolioData || []).forEach(a => {
                                if (a.platform === b.n) {
                                    investedInThisPlatformIDR += (a.currency === 'IDR' ? a.invested : a.invested * exchangeRate);
                                }
                            });
                            
                            let unallocatedIDR = valIDR - investedInThisPlatformIDR;
                            let unallocatedBase = b.c === 'IDR' ? unallocatedIDR : (unallocatedIDR / exchangeRate);
                            
                            // Fix floating-point imprecision (e.g., -0.0000001 becoming -$0)
                            if (Math.abs(unallocatedBase) < 0.005) {
                                unallocatedBase = 0;
                            }
                            
                            const isWarning = unallocatedBase < -0.005;
                            const warningHtml = isWarning ? `<div class="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>Invested exceeds transferred cash</div>` : '';

                            return `
                            <div class="flex items-center justify-between p-4 bg-black/20 rounded-2xl border ${isWarning ? 'border-rose-500/30' : 'border-white/5'} hover:bg-black/40 transition group">
                                <div class="flex items-center gap-3">
                                    <div class="w-2.5 h-2.5 rounded-full ${isWarning ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]'}"></div>
                                    <div>
                                        <div class="font-bold text-slate-200 text-sm sm:text-base">${b.n}</div>
                                        ${warningHtml}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="font-bold font-mono ${isWarning ? 'text-rose-400' : 'text-white'} group-hover:text-purple-400 transition">${fmt(unallocatedBase, b.c)}</div>
                                    <div class="text-[9px] font-mono text-slate-500 mt-1">Total Transferred: ${fmt(b.v, b.c)}</div>
                                </div>
                            </div>
                            `;
                        }).join('');
                    }
                }
                
                const listEl = document.getElementById('investments-list');
                if (listEl) listEl.innerHTML = html;
                
                renderPortfolio(totalCashIDR);
            }

            function renderPortfolio(totalCashIDR) {
                let totalInvestedIDR = 0;
                let totalMarketValIDR = 0;
                
                const pList = [...(window.portfolioData || [])].sort((a, b) => {
                    const valA = a.currency === 'IDR' ? a.currentValue : (a.currentValue * exchangeRate);
                    const valB = b.currency === 'IDR' ? b.currentValue : (b.currentValue * exchangeRate);
                    return valB - valA;
                });
                
                let pListHtml = '';
                if (pList.length === 0) {
                    pListHtml = '<div class="text-center py-10 text-slate-500 text-sm italic glass rounded-2xl">No assets added. Click Add Asset to start tracking your portfolio.</div>';
                } else {
                    pListHtml = pList.map(a => {
                        const invIDR = a.currency === 'IDR' ? a.invested : (a.invested * exchangeRate);
                        const valIDR = a.currency === 'IDR' ? a.currentValue : (a.currentValue * exchangeRate);
                        totalInvestedIDR += invIDR;
                        totalMarketValIDR += valIDR;
                        
                        const pnl = valIDR - invIDR;
                        const roi = invIDR > 0 ? (pnl / invIDR) * 100 : 0;
                        const isProfit = pnl >= 0;
                        const colorClass = isProfit ? 'text-emerald-400' : 'text-rose-400';
                        const sign = isProfit ? '+' : '';
                        
                        return `
                        <div class="p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-black/40 transition relative group cursor-pointer" onclick="openPortfolioModal('${a.id}')">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <div class="font-bold text-white text-base">${a.name}</div>
                                    <div class="text-[10px] uppercase font-bold tracking-wider text-slate-500">${a.platform}</div>
                                </div>
                                <div class="text-right">
                                    <div class="font-bold font-mono ${colorClass} text-sm">${sign}${fmt(pnl, 'IDR')}</div>
                                    <div class="text-[10px] font-bold ${colorClass} bg-${isProfit ? 'emerald' : 'rose'}-500/10 px-2 py-0.5 rounded ml-auto w-fit mt-1">${sign}${roi.toFixed(2)}%</div>
                                </div>
                            </div>
                            <div class="flex justify-between text-xs font-mono text-slate-400 border-t border-white/5 pt-2 mt-1">
                                <div>Cost: ${fmt(a.invested, a.currency)}</div>
                                <div class="text-slate-200">Val: ${fmt(a.currentValue, a.currency)}</div>
                            </div>
                        </div>
                        `;
                    }).join('');
                }
                
                document.getElementById('portfolio-assets-list').innerHTML = pListHtml;
                
                const unallocatedCashIDR = Math.max(0, totalCashIDR - totalInvestedIDR);
                const overallPortfolioValueIDR = totalMarketValIDR + unallocatedCashIDR;
                const overallInvestedCashIDR = totalCashIDR; 
                
                const overallPnl = overallPortfolioValueIDR - overallInvestedCashIDR;
                const overallRoi = overallInvestedCashIDR > 0 ? (overallPnl / overallInvestedCashIDR) * 100 : 0;
                
                document.getElementById('portfolio-total-value').textContent = window.isBalancesHidden ? '***' : fmt(overallPortfolioValueIDR, 'IDR');
                document.getElementById('portfolio-invested-cash').textContent = window.isBalancesHidden ? '***' : fmt(overallInvestedCashIDR, 'IDR');
                
                const pnlEl = document.getElementById('portfolio-total-pnl');
                
                const sign = overallPnl >= 0 ? '+' : '';
                const colorClass = overallPnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
                const bgClass = overallPnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10';
                
                const absValue = window.isBalancesHidden ? '***' : `${sign}${fmt(overallPnl, 'IDR')}`;
                
                pnlEl.innerHTML = `
                    ${absValue}
                    <span class="text-[10px] ml-1.5 px-1.5 py-0.5 rounded ${bgClass} ${colorClass}">${sign}${overallRoi.toFixed(2)}%</span>
                `;
                
                pnlEl.className = `text-sm font-bold font-mono flex items-center ${overallPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
                
                renderPortfolioChart(pList, unallocatedCashIDR);
            }
            
            function renderPortfolioChart(pList, unallocatedCashIDR) {
                const ctx = document.getElementById('portfolio-donut-chart');
                if (!ctx) return;
                
                if (portfolioChart) portfolioChart.destroy();
                
                const bgColorsSource = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];
                
                let chartItems = [];
                pList.forEach(a => {
                    const val = a.currency === 'IDR' ? a.currentValue : (a.currentValue * exchangeRate);
                    if (val > 0) chartItems.push({ label: a.name, val: val });
                });
                
                if (unallocatedCashIDR > 0) chartItems.push({ label: 'Cash', val: unallocatedCashIDR });
                
                // Sort biggest items first
                chartItems.sort((a, b) => b.val - a.val);
                
                let labels = [];
                let data = [];
                let bgColors = [];
                
                if (chartItems.length === 0) { 
                    labels.push('Empty'); data.push(1); bgColors.push('#334155'); 
                } else {
                    chartItems.forEach((item, i) => {
                        labels.push(item.label);
                        data.push(item.val);
                        bgColors.push(bgColorsSource[i % bgColorsSource.length]);
                    });
                }
                
                let totalChartValue = data.reduce((a, b) => a + b, 0);
                
                let legendHtml = '';
                if (data.length === 1 && labels[0] === 'Empty') {
                    legendHtml = '<div class="text-xs text-slate-500 italic p-2 text-center">No assets</div>';
                } else {
                    labels.forEach((label, i) => {
                        const val = data[i];
                        const bg = bgColors[i % bgColors.length];
                        const pct = totalChartValue > 0 ? ((val / totalChartValue) * 100).toFixed(1) : 0;
                        legendHtml += `
                        <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-black/20 border border-white/5 hover:bg-black/40 transition">
                            <div class="flex items-center gap-2">
                                <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${bg}; box-shadow: 0 0 8px ${bg}80"></div>
                                <span class="text-slate-300 font-medium truncate max-w-[70px] md:max-w-[85px]" title="${label}">${label}</span>
                            </div>
                            <span class="font-bold font-mono text-white text-[10px]">${pct}%</span>
                        </div>
                        `;
                    });
                }
                
                const legendEl = document.getElementById('portfolio-chart-legend');
                if (legendEl) legendEl.innerHTML = legendHtml;
                
                portfolioChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 4 }] },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '75%',
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let val = context.raw;
                                        if (data.length === 1 && labels[0] === 'Empty') return '0 IDR';
                                        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
                                    }
                                }
                            }
                        }
                    }
                });
            }
            
            window.switchPortfolioTab = (tab) => {
                const tradeBtn = document.getElementById('tab-trade');
                const editBtn = document.getElementById('tab-edit');
                const tradeContent = document.getElementById('portfolio-trade-content');
                const editContent = document.getElementById('portfolio-edit-content');
                
                if (tab === 'trade') {
                    tradeBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-white bg-purple-600/30 shadow-sm';
                    editBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-slate-200';
                    tradeContent.classList.remove('hidden');
                    editContent.classList.add('hidden');
                } else {
                    editBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-white bg-purple-600/30 shadow-sm';
                    tradeBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-emerald-400';
                    editContent.classList.remove('hidden');
                    tradeContent.classList.add('hidden');
                }
            };

            window.setTradeType = (type) => {
                document.getElementById('trade-type').value = type;
                const buyBtn = document.getElementById('trade-buy-btn');
                const sellBtn = document.getElementById('trade-sell-btn');
                const updateBtn = document.getElementById('trade-update-btn');
                
                const amtContainer = document.getElementById('trade-amount-container');
                const valContainer = document.getElementById('trade-new-value-container');
                const infoTxt = document.getElementById('trade-info');
                
                // Reset styling
                [buyBtn, sellBtn, updateBtn].forEach(b => b.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all text-slate-400 hover:text-white');
                
                if (type === 'buy') {
                    buyBtn.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                    amtContainer.classList.remove('hidden');
                    valContainer.classList.add('hidden');
                    infoTxt.innerHTML = 'This will automatically <strong>ADD</strong> the amount to your Invested Cost and Market Value.';
                } else if (type === 'sell') {
                    sellBtn.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]';
                    amtContainer.classList.remove('hidden');
                    valContainer.classList.add('hidden');
                    infoTxt.innerHTML = 'This will <strong>PROPORTIONALLY REDUCE</strong> your Invested Cost, and deduct the amount from your Market Value.';
                } else {
                    updateBtn.className = 'flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]';
                    amtContainer.classList.add('hidden');
                    valContainer.classList.remove('hidden');
                    infoTxt.innerHTML = 'This will <strong>ONLY UPDATE</strong> your Market Value. Your Invested Cost will not change. Use this to record profit/loss.';
                }
            };
            
            window.openPortfolioModal = (id = null) => {
                const modal = document.getElementById('portfolio-modal');
                const title = document.getElementById('portfolio-modal-title');
                
                const invAccs = SYSTEM_CONFIG.investmentAccounts || [];
                document.getElementById('portfolio-platform').innerHTML = invAccs.map(a => `<option value="${a}">${a}</option>`).join('') || '<option value="" disabled>No investment accounts in Config</option>';
                
                if (id && typeof id === 'string') {
                    document.getElementById('portfolio-tabs-container').classList.remove('hidden');
                    switchPortfolioTab('trade');
                    setTradeType('buy');
                    document.getElementById('trade-amount').value = '';
                    document.getElementById('trade-new-value').value = '';

                    const item = window.portfolioData.find(a => a.id === id);
                    if (item) {
                        document.getElementById('trade-amount').dataset.oldValue = item.currentValue;
                        title.innerHTML = '<i class="fas fa-layer-group text-purple-400"></i> Manage Asset';
                        document.getElementById('portfolio-id').value = item.id;
                        document.getElementById('portfolio-name').value = item.name;
                        document.getElementById('portfolio-platform').value = item.platform;
                        document.getElementById('portfolio-curr').value = item.currency;
                        document.getElementById('portfolio-invested').value = item.invested;
                        document.getElementById('portfolio-value').value = item.currentValue;
                        
                        let delBtn = document.getElementById('portfolio-del-btn');
                        if (!delBtn) {
                            delBtn = document.createElement('button');
                            delBtn.id = 'portfolio-del-btn';
                            delBtn.className = 'w-full mt-3 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 font-bold py-3 rounded-xl transition';
                            delBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i>Delete Asset';
                            document.getElementById('portfolio-save-btn').parentNode.appendChild(delBtn);
                        }
                        delBtn.onclick = () => window.deletePortfolioAsset(id);
                        delBtn.classList.remove('hidden');
                    }
                } else {
                    document.getElementById('portfolio-tabs-container').classList.add('hidden');
                    switchPortfolioTab('edit');
                    title.innerHTML = '<i class="fas fa-layer-group text-purple-400"></i> Add Asset';
                    document.getElementById('portfolio-id').value = '';
                    document.getElementById('portfolio-name').value = '';
                    document.getElementById('portfolio-invested').value = '';
                    document.getElementById('portfolio-value').value = '';
                    const delBtn = document.getElementById('portfolio-del-btn');
                    if (delBtn) delBtn.classList.add('hidden');
                }
                
                modal.classList.remove('hidden');
            };
            
            window.savePortfolioAsset = () => {
                const id = document.getElementById('portfolio-id').value;
                const name = document.getElementById('portfolio-name').value.trim();
                const platform = document.getElementById('portfolio-platform').value;
                const currency = document.getElementById('portfolio-curr').value;
                
                let newPortfolio = [...(window.portfolioData || [])];
                const isTradeMode = !document.getElementById('portfolio-trade-content').classList.contains('hidden') && id;
                
                let realizedPnL = 0;
                let sellPlatform = platform;
                let sellCurrency = currency;
                
                if (isTradeMode) {
                    const tradeType = document.getElementById('trade-type').value;
                    const tradeAmount = parseFloat(document.getElementById('trade-amount').value) || 0;
                    const newMarketValueInput = parseFloat(document.getElementById('trade-new-value').value) || 0;
                    
                    if (tradeType !== 'update' && tradeAmount <= 0) return showToast('Trade Amount must be greater than 0', 'error');
                    if (tradeType === 'update' && newMarketValueInput < 0) return showToast('New Market Value cannot be negative', 'error');
                    
                    const existingIdx = newPortfolio.findIndex(a => a.id === id);
                    if (existingIdx > -1) {
                        const oldAsset = newPortfolio[existingIdx];
                        
                        if (tradeType === 'buy') {
                            oldAsset.invested += tradeAmount;
                            oldAsset.currentValue += tradeAmount;
                        } else if (tradeType === 'sell') {
                            const sellRatio = oldAsset.currentValue > 0 ? (tradeAmount / oldAsset.currentValue) : 0;
                            const principalSold = oldAsset.invested * sellRatio;
                            
                            oldAsset.invested = Math.max(0, oldAsset.invested - principalSold);
                            oldAsset.currentValue = Math.max(0, oldAsset.currentValue - tradeAmount);
                            
                            realizedPnL = tradeAmount - principalSold;
                            sellPlatform = oldAsset.platform;
                            sellCurrency = oldAsset.currency;
                        } else if (tradeType === 'update') {
                            oldAsset.currentValue = newMarketValueInput;
                        }
                    }
                } else {
                    const invested = parseFloat(document.getElementById('portfolio-invested').value) || 0;
                    const currentValue = parseFloat(document.getElementById('portfolio-value').value) || 0;
                    if (!name || !platform) return showToast('Name and Platform are required', 'error');
                    
                    // Smart Merge Detection for New Assets
                    if (!id) {
                        const existingIdx = newPortfolio.findIndex(a => a.name.toLowerCase() === name.toLowerCase() && a.platform === platform && a.currency === currency);
                        if (existingIdx > -1) {
                            if (confirm(`You already have an asset named "${name}" in ${platform}.\n\nWould you like to MERGE this new amount into the existing one instead of creating a duplicate row?\n\nIf merged:\n- Your new Invested cost will be added to the old one.\n- The Current Market Value will also be ADDED to your old one.`)) {
                                newPortfolio[existingIdx].invested += invested;
                                newPortfolio[existingIdx].currentValue += currentValue;
                                executeSave(newPortfolio);
                                return;
                            }
                        }
                    }
                    
                    const asset = { id: id || Date.now().toString(), name, platform, currency, invested, currentValue };
                    
                    if (id) {
                        const idx = newPortfolio.findIndex(a => a.id === id);
                        if (idx > -1) newPortfolio[idx] = asset; else newPortfolio.push(asset);
                    } else newPortfolio.push(asset);
                }
                
                executeSave(newPortfolio, realizedPnL, sellPlatform, sellCurrency, name);
                
                function executeSave(portfolioToSave, pnl = 0, pnlPlatform = '', pnlCurrency = '', assetName = '') {
                    const btn = document.getElementById('portfolio-save-btn');
                    const origTxt = btn.innerHTML;
                    btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent mx-auto"></div>';
                    btn.disabled = true;
                    
                    fetch(WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'updatePortfolio', portfolio: portfolioToSave })
                    }).then(r => r.json()).then(d => {
                        if (d.status === 'success') {
                            if (Math.abs(pnl) >= 0.01) {
                                // Auto-book profit/loss
                                const type = pnl > 0 ? 'income' : 'expense';
                                const cat = pnl > 0 ? 'Investment Profit' : 'Investment Loss';
                                const amt = Math.abs(pnl);
                                
                                fetch(WEB_APP_URL, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        action: 'addTransaction',
                                        type: type,
                                        date: new Date().toISOString().split('T')[0],
                                        amount: amt,
                                        currency: pnlCurrency,
                                        account: pnlPlatform,
                                        category: cat,
                                        note: `Auto-realized PnL from selling ${assetName}`
                                    })
                                }).then(r => r.json()).then(pnlRes => {
                                     showToast(`Asset saved & ${pnl > 0 ? 'Profit' : 'Loss'} booked!`, 'success');
                                     window.portfolioData = portfolioToSave;
                                     // Full refresh to fetch the new transaction and update wallet balances
                                     if (typeof fetchData === 'function') fetchData(); 
                                     document.getElementById('portfolio-modal').classList.add('hidden');
                                });
                            } else {
                                showToast("Asset saved!", 'success');
                                window.portfolioData = portfolioToSave;
                                renderAll();
                                document.getElementById('portfolio-modal').classList.add('hidden');
                            }
                        } else throw new Error(d.message);
                    }).catch(e => showToast(e.message, 'error')).finally(() => { btn.innerHTML = origTxt; btn.disabled = false; });
                }
            };
            
            window.deletePortfolioAsset = (id) => {
                if (!confirm('Are you sure you want to delete this asset?')) return;
                
                let newPortfolio = (window.portfolioData || []).filter(a => a.id !== id);
                
                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'updatePortfolio', portfolio: newPortfolio })
                }).then(r => r.json()).then(d => {
                    if (d.status === 'success') {
                        showToast("Asset deleted!", 'success');
                        window.portfolioData = newPortfolio;
                        renderAll();
                        document.getElementById('portfolio-modal').classList.add('hidden');
                    } else throw new Error(d.message);
                }).catch(e => showToast(e.message, 'error'));
            };

            window.toggleCurrency = (id, usdVal) => {
                const el = document.getElementById(id);
                if (el.textContent.includes('$')) { const idrVal = usdVal * exchangeRate; el.textContent = fmt(idrVal, 'IDR'); el.classList.add('text-yellow-400'); } else { el.textContent = fmt(usdVal, 'USD'); el.classList.remove('text-yellow-400'); }
            };

            function renderDaily(data) {
                const dly = {}; data.filter(d => d.type === 'expense' && d.cat !== 'Transfer').forEach(d => { if (!dly[d.date]) dly[d.date] = { idr: 0, usd: 0 }; if (d.curr === 'IDR') dly[d.date].idr += d.amt; else dly[d.date].usd += d.amt; });
                document.getElementById('daily-body').innerHTML = Object.keys(dly).sort().reverse().map(dt => `<tr onclick="showDailyDetails('${dt}')" class="cursor-pointer hover:bg-white/10 transition border-b border-white/5 last:border-0"><td class="px-6 py-4 text-sm text-slate-300 font-medium font-mono">${dt}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].idr > 0 ? fmt(dly[dt].idr, 'IDR') : '-'}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].usd > 0 ? fmt(dly[dt].usd, 'USD') : '-'}</td></tr>`).join('');
            }

            window.showDailyDetails = function(dateStr) {
                const items = masterData.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date === dateStr);
                const displayDate = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                document.getElementById('cal-detail-title').textContent = displayDate;
                document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(225,29,72,0.8)]"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">${x.cat} • ${x.acc}</div></div></div><div class="text-rose-400 font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg">${fmt(x.amt, x.curr)}</div></div>`).join('');
                document.getElementById('calendar-detail-modal').classList.remove('hidden');
            };


            let monthlyDate = new Date();

            function renderMonthlyOverview(data) {
                const yyyy = monthlyDate.getFullYear();
                const mm = String(monthlyDate.getMonth() + 1).padStart(2, '0');
                const currentMonthKey = `${yyyy}-${mm}`;
                
                document.getElementById('monthly-header-text').textContent = monthlyDate.toLocaleString('default', { month: 'long', year: 'numeric' });

                const mon = {};
                data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date.substring(0, 7) === currentMonthKey).forEach(d => {
                    const catKey = d.cat;
                    if (!mon[catKey]) mon[catKey] = { cat: catKey, idr: 0, usd: 0 };
                    if (d.curr === 'IDR') mon[catKey].idr += d.amt;
                    else mon[catKey].usd += d.amt;
                });
                
                // Sort by total IDR amount descending
                const sortedKeys = Object.keys(mon).sort((a, b) => mon[b].idr - mon[a].idr);
                
                document.getElementById('monthly-body').innerHTML = sortedKeys.map(k => {
                    const m = mon[k];
                    return `<tr onclick="showMonthlyDetails('${m.cat}', '${currentMonthKey}')" class="cursor-pointer hover:bg-white/10 transition border-b border-white/5 last:border-0 group">
                        <td class="px-6 py-4 text-sm"><span class="bg-black/30 border border-white/5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 group-hover:text-white transition">${m.cat}</span></td>
                        <td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${m.idr > 0 ? fmt(m.idr, 'IDR') : '-'}</td>
                        <td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${m.usd > 0 ? fmt(m.usd, 'USD') : '-'}</td>
                    </tr>`;
                }).join('');
                if (sortedKeys.length === 0) document.getElementById('monthly-body').innerHTML = '<tr><td colspan="3" class="text-center py-10 text-slate-500 text-sm italic">No data found for this month</td></tr>';
            }

            document.getElementById('prev-monthly').addEventListener('click', () => { monthlyDate.setMonth(monthlyDate.getMonth() - 1); renderMonthlyOverview(masterData); });
            document.getElementById('next-monthly').addEventListener('click', () => { monthlyDate.setMonth(monthlyDate.getMonth() + 1); renderMonthlyOverview(masterData); });

            window.showMonthlyDetails = function(cat, monthKey) {
                const items = masterData.filter(d => d.type === 'expense' && d.cat === cat && d.date.substring(0, 7) === monthKey);
                document.getElementById('cal-detail-title').textContent = `${cat} - ${monthlyDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(225,29,72,0.8)]"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">${x.date} • ${x.acc}</div></div></div><div class="text-rose-400 font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg">${fmt(x.amt, x.curr)}</div></div>`).join('');
                document.getElementById('calendar-detail-modal').classList.remove('hidden');
            };

            function renderCalendar(data) {
                const safeData = Array.isArray(data) ? data : [];
                const g = document.getElementById('calendar-grid'); g.innerHTML = ''; const y = calendarDate.getFullYear(), m = calendarDate.getMonth(); document.getElementById('calendar-header').textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                for (let i = 0; i < new Date(y, m, 1).getDay(); i++) g.appendChild(document.createElement('div'));
                for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
                    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, items = safeData.filter(i => i.date === dateStr), el = document.createElement('div');
                    el.className = "calendar-day bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center justify-start cursor-pointer relative overflow-hidden group";
                    el.innerHTML = `<span class="text-xs text-slate-400 mb-1 font-bold z-10 group-hover:text-white transition">${d}</span>`;
                    if (items.length > 0) {
                        el.innerHTML += `<div class="flex gap-1.5 mt-auto pb-1 z-10">${items.some(x => x.type === 'income') ? '<div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>' : ''}${items.some(x => x.type === 'expense') ? '<div class="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(225,29,72,0.8)]"></div>' : ''}</div>`;
                        el.onclick = () => {
                            document.getElementById('cal-detail-title').textContent = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full ${x.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">${x.cat} • ${x.acc}</div></div></div><div class="${x.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg">${fmt(x.amt, x.curr)}</div></div>`).join('');
                            document.getElementById('calendar-detail-modal').classList.remove('hidden');
                        };
                    }
                    g.appendChild(el);
                }
            }
            document.getElementById('prev-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(masterData); });
            document.getElementById('next-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(masterData); });
            document.getElementById('cal-close').addEventListener('click', () => document.getElementById('calendar-detail-modal').classList.add('hidden'));

            let myChart;
            function updateChart(data) {
                const curr = document.getElementById('chart-currency-toggle').value; const exps = data.filter(d => d.type === 'expense' && d.curr === curr && d.cat !== 'Transfer'); const totals = {}; exps.forEach(d => totals[d.cat] = (totals[d.cat] || 0) + d.amt);
                const ctx = document.getElementById('expense-pie-chart').getContext('2d'); if (myChart) myChart.destroy();

                // Premium color palette for pie chart
                const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

                myChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(totals),
                        datasets: [{
                            data: Object.values(totals),
                            backgroundColor: chartColors,
                            borderWidth: 2,
                            borderColor: '#0B1325',
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        plugins: {
                            legend: { display: false },
                            tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12, displayColors: true }
                        },
                        cutout: '75%',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });

                document.getElementById('expense-details').innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, v], i) => `<div class="flex justify-between items-center text-xs py-2 border-b border-white/5 last:border-0"><div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background-color: ${chartColors[i % chartColors.length]}"></div><span class="text-slate-300 font-medium">${k}</span></div><span class="font-mono text-white font-bold bg-white/5 px-2 py-0.5 rounded-md">${fmt(v, curr)}</span></div>`).join('');
            }

            let trendChart;
            function updateTrendChart(data) {
                const ctx = document.getElementById('trend-line-chart').getContext('2d');
                if (trendChart) trendChart.destroy();
                const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const rawData = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && new Date(d.date) >= thirtyDaysAgo);
                const dailyTotals = {}; rawData.forEach(d => { const date = d.date; const amountIDR = d.curr === 'USD' ? d.amt * exchangeRate : d.amt; dailyTotals[date] = (dailyTotals[date] || 0) + amountIDR; });
                const sortedDates = Object.keys(dailyTotals).sort(); const values = sortedDates.map(date => dailyTotals[date]);
                const labels = sortedDates.map(d => { const dateObj = new Date(d); return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });

                trendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Expenses (IDR)',
                            data: values,
                            borderColor: '#4F46E5',
                            backgroundColor: (context) => { const ctx = context.chart.ctx; const gradient = ctx.createLinearGradient(0, 0, 0, 300); gradient.addColorStop(0, 'rgba(79, 70, 229, 0.5)'); gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)'); return gradient; },
                            borderWidth: 3,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#4F46E5',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12 }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, family: "'Inter', sans-serif" } } },
                            y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] }, ticks: { color: '#64748b', font: { size: 10, family: "'JetBrains Mono', monospace" }, callback: function (value) { return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'; } } }
                        }
                    }
                });
            }

            let isSubmittingEntry = false;
            document.getElementById('add-entry-form').addEventListener('submit', e => {
                e.preventDefault(); 
                if (isSubmittingEntry) return;
                isSubmittingEntry = true;
                
                const btn = document.getElementById('submit-btn'); 
                btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent mx-auto"></div>'; 
                btn.disabled = true;

                const type = document.querySelector('input[name="entry-type"]:checked').value, date = document.getElementById('entry-date').value, desc = document.getElementById('entry-desc').value;
                let payload = {};

                if (isEditing) {
                    let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                    payload = {
                        action: 'edit',
                        oldSheetName: editItem.type === 'income' ? 'Income' : 'Expenses',
                        originalData: editItem,
                        newSheetName: type === 'income' ? 'Income' : 'Expenses',
                        newData: { date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: readAmt('entry-amt-source') }
                    };
                } else {
                    if (type === 'transfer') {
                        const fromAmt = readAmt('entry-amt-source'), toAmtRaw = document.getElementById('entry-amt-target').value, toAmt = toAmtRaw ? readAmt('entry-amt-target') : fromAmt;
                        if (document.getElementById('entry-acc-source').value === document.getElementById('entry-acc-target').value && document.getElementById('entry-curr-source').value === document.getElementById('entry-curr-target').value) { 
                            showToast("Source and Target are identical!", 'error'); 
                            isSubmittingEntry = false;
                            btn.disabled = false; 
                            updateUIForType(type);
                            return; 
                        }
                        payload = { action: 'transfer', date, description: desc, fromAccount: document.getElementById('entry-acc-source').value, fromCurrency: document.getElementById('entry-curr-source').value, fromAmount: Math.abs(fromAmt), toAccount: document.getElementById('entry-acc-target').value, toCurrency: document.getElementById('entry-curr-target').value, toAmount: Math.abs(toAmt) };
                    } else {
                        let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                        payload = { action: 'add', sheetName: type === 'income' ? 'Income' : 'Expenses', date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: readAmt('entry-amt-source') };
                    }
                }

                fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) })
                    .then(r => r.json())
                    .then(d => {
                        if (d.status === 'success') { 
                            showToast(d.message, 'success'); 
                            resetForm(); 
                            setTimeout(fetchData, 1500); 
                        } else {
                            throw new Error(d.message);
                        }
                    })
                    .catch(e => showToast("Error: " + e.message, 'error'))
                    .finally(() => { 
                        isSubmittingEntry = false;
                        btn.disabled = false; 
                        updateUIForType(document.querySelector('input[name="entry-type"]:checked').value);
                    });
            });

            function resetForm() {
                document.getElementById('add-entry-form').reset(); 
                const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                document.getElementById('entry-date').value = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
                isEditing = false; editItem = null; document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primaryLight border border-theme-primary/30"><i class="fas fa-plus"></i></div> New Entry'; document.getElementById('cancel-edit-btn').classList.add('hidden');
                document.getElementById('entry-cat-other').classList.add('hidden');
                updateWalletOptions('IDR', 'entry-acc-source'); updateWalletOptions('IDR', 'entry-acc-target');
                document.querySelector('input[name="entry-type"][value="expense"]').checked = true; document.querySelector('input[name="entry-type"][value="expense"]').dispatchEvent(new Event('change'));
            }
            document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

            document.addEventListener('click', e => {
                const btnEdit = e.target.closest('.edit-btn'), btnDel = e.target.closest('.del-btn');

                if (btnDel) {
                    itemToDelete = JSON.parse(btnDel.dataset.item);
                    document.getElementById('del-item-preview').innerHTML = `<div class="font-bold text-white text-base mb-1">${itemToDelete.desc}</div><div class="${itemToDelete.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-xl font-bold">${fmt(itemToDelete.amt, itemToDelete.curr)}</div><div class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">${itemToDelete.date} • ${itemToDelete.acc}</div>`;
                    document.getElementById('delete-modal').classList.remove('hidden');
                }

                if (btnEdit) {
                    const item = JSON.parse(btnEdit.dataset.item);
                    if (item.cat === 'Transfer') { showToast("Please delete and recreate transfer.", 'error'); return; }
                    isEditing = true; editItem = item;
                    document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 border border-orange-500/30"><i class="fas fa-pen"></i></div> Edit Entry'; document.getElementById('cancel-edit-btn').classList.remove('hidden');

                    // Switch to Add Tab
                    updateTabUI('view-add');

                    document.querySelector(`input[name="entry-type"][value="${item.type}"]`).checked = true;
                    updateSegmentIndicator(item.type);
                    updateUIForType(item.type);

                    document.getElementById('entry-desc').value = item.desc;
                    document.getElementById('entry-date').value = item.date;

                    const catSelect = document.getElementById('entry-cat');
                    if ([...catSelect.options].map(o => o.value).includes(item.cat)) catSelect.value = item.cat;
                    else { catSelect.value = 'Other'; document.getElementById('entry-cat-other').classList.remove('hidden'); document.getElementById('entry-cat-other').value = item.cat; }

                    document.getElementById('entry-curr-source').value = item.curr;
                    updateWalletOptions(item.curr, 'entry-acc-source');
                    document.getElementById('entry-acc-source').value = item.acc;
                    document.getElementById('entry-amt-source').value = item.amt;
                }
            });

            document.getElementById('del-cancel').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
            document.getElementById('del-confirm').addEventListener('click', () => {
                const btn = document.getElementById('del-confirm'); const origTxt = btn.textContent; btn.innerHTML = '<div class="loader w-4 h-4 border-2 border-white border-t-transparent mx-auto"></div>';
                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'delete', sheetName: itemToDelete.type === 'income' ? 'Income' : 'Expenses', originalData: itemToDelete })
                }).then(r => r.json()).then(d => {
                    document.getElementById('delete-modal').classList.add('hidden'); btn.textContent = origTxt; if (d.status === 'success') { showToast("Deleted successfully", 'success'); fetchData(); } else showToast(d.message, 'error');
                });
            });

            function fmt(n, c) {
                if (window.isBalancesHidden) return '***';
                const maxDigits = c === 'IDR' ? 0 : 2;
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: maxDigits }).format(n);
            }
            function showToast(m, type) {
                const t = document.getElementById('toast');
                t.className = `fixed top-5 left-1/2 transform -translate-x-1/2 glass text-white px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border z-[90] flex items-center gap-3 min-w-[250px] justify-center transition-all duration-300 translate-y-0 opacity-100 ${type === 'error' ? 'border-rose-500/30 bg-rose-950/80' : 'border-emerald-500/30 bg-emerald-950/80'}`;
                t.innerHTML = `${type === 'error' ? '<div class="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400"><i class="fas fa-exclamation-circle text-lg"></i></div>' : '<div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><i class="fas fa-check text-lg"></i></div>'} <span class="font-medium text-sm tracking-wide">${m}</span>`;
                t.classList.remove('hidden');
                setTimeout(() => { t.classList.add('translate-y-[-100px]', 'opacity-0'); setTimeout(() => t.classList.add('hidden'), 300); }, 3000);
            }

            ['filter-start', 'filter-end', 'filter-cat', 'filter-acc', 'filter-search'].forEach(i => document.getElementById(i).addEventListener('input', renderAll));

            const visBtn = document.getElementById('toggle-visibility-btn');
            if (window.isBalancesHidden) visBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            visBtn.addEventListener('click', () => {
                window.isBalancesHidden = !window.isBalancesHidden;
                localStorage.setItem('hideBalances', window.isBalancesHidden);
                visBtn.innerHTML = window.isBalancesHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
                renderAll();
                if (budgetLoaded) renderBudgetView(); // also refresh Budget tab
            });
            document.getElementById('chart-currency-toggle').addEventListener('change', () => updateChart(masterData));
            document.querySelectorAll('.sortable').forEach(s => s.addEventListener('click', e => { sortState.k = e.target.dataset.sort; sortState.o = sortState.o === 'asc' ? 'desc' : 'asc'; renderAll(); }));
            function getSnapshotSummary(data) {
                const bals = {}; let incIDR = 0, expIDR = 0, incUSD = 0, expUSD = 0;
                data.forEach(d => {
                    const k = `${d.acc}-${d.curr}`;
                    if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
                    if (d.type === 'income') {
                        bals[k].v += d.amt;
                        if (d.cat !== 'Transfer' && d.cat !== 'Initial Balance') d.curr === 'IDR' ? incIDR += d.amt : incUSD += d.amt;
                    } else {
                        bals[k].v -= d.amt;
                        if (d.cat !== 'Transfer') d.curr === 'IDR' ? expIDR += d.amt : expUSD += d.amt;
                    }
                });
                const income = incIDR + (incUSD * exchangeRate);
                const expense = expIDR + (expUSD * exchangeRate);
                const netFlow = income - expense;
                const netWorth = Object.values(bals).reduce((sum, b) => sum + (b.c === 'USD' ? b.v * exchangeRate : b.v), 0);
                return { bals, income, expense, netFlow, netWorth };
            }

            function populateScreenshotCard(isMobile) {
                const card = document.getElementById('screenshot-card');
                card.classList.toggle('mobile-card', isMobile);
                const summary = getSnapshotSummary(masterData);
                const now = new Date();
                const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const money = (value, currency, compact = false) => {
                    if (window.isBalancesHidden) return '***';
                    if (!compact) return fmt(value, currency);
                    const label = currency === 'IDR' ? 'IDR' : '$';
                    const abs = Math.abs(value);
                    const sign = value < 0 ? '-' : '';
                    if (currency === 'IDR' && abs >= 1000000) return `${sign}${label} ${(abs / 1000000).toFixed(abs >= 10000000 ? 1 : 2)}M`;
                    if (currency === 'IDR' && abs >= 1000) return `${sign}${label} ${(abs / 1000).toFixed(0)}K`;
                    if (currency === 'USD') return `${sign}${label}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                    return `${sign}${label} ${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                };
                document.getElementById('share-date').textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                document.getElementById('share-networth').textContent = money(summary.netWorth, 'IDR', isMobile);
                document.getElementById('share-rate').textContent = `1 USD = ${money(exchangeRate, 'IDR', isMobile)}`;
                document.getElementById('share-income').textContent = money(summary.income, 'IDR', isMobile);
                document.getElementById('share-expense').textContent = money(summary.expense, 'IDR', isMobile);
                document.getElementById('share-netflow').textContent = money(summary.netFlow, 'IDR', isMobile);
                document.getElementById('share-netflow').className = `share-stat-value ${summary.netFlow >= 0 ? 'share-green' : 'share-red'}`;
                document.getElementById('share-wallet-count').textContent = `${Object.keys(summary.bals).length} wallets tracked`;

                const recent = [...masterData].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, isMobile ? 3 : 5);
                document.getElementById('share-recent').innerHTML = recent.length ? recent.map(d => `
                    <div class="share-row">
                        <div class="share-row-main">
                            <div class="share-row-title">${d.desc}</div>
                            <div class="share-row-sub">${d.date} • ${d.cat}</div>
                        </div>
                        <div class="share-row-amt ${d.type === 'income' ? 'share-green' : 'share-red'}">${d.type === 'income' ? '+' : '-'} ${money(d.amt, d.curr, isMobile)}</div>
                    </div>
                `).join('') : '<div class="share-row"><div class="share-row-title">No recent activity</div></div>';

                const thisMonthExps = masterData.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date.startsWith(thisMonth));
                const catTotals = {};
                thisMonthExps.forEach(d => catTotals[d.cat] = (catTotals[d.cat] || 0) + (d.curr === 'USD' ? d.amt * exchangeRate : d.amt));
                const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, isMobile ? 3 : 5);
                document.getElementById('share-categories').innerHTML = topCats.length ? topCats.map(([cat, val]) => `
                    <div class="share-row">
                        <div class="share-row-main">
                            <div class="share-row-title">${cat}</div>
                            <div class="share-row-sub">This month</div>
                        </div>
                        <div class="share-row-amt">${money(val, 'IDR', isMobile)}</div>
                    </div>
                `).join('') : '<div class="share-row"><div class="share-row-title">No expenses this month</div></div>';
            }

            document.getElementById('export-btn').addEventListener('click', async () => {
                if (masterData.length === 0) { showToast('No data to export', 'error'); return; }
                const isMobileExport = window.matchMedia('(max-width: 767px)').matches;
                const stage = document.getElementById('screenshot-card-stage');
                const card = document.getElementById('screenshot-card');
                try {
                    populateScreenshotCard(isMobileExport);
                    stage.classList.add('active');
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const c = await html2canvas(card, {
                        backgroundColor: '#050B14',
                        scale: isMobileExport ? 3 : 2,
                        useCORS: true,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: isMobileExport ? 430 : 1080,
                        windowHeight: card.scrollHeight,
                        ignoreElements: (e) => e.id === 'toast' || e.id === 'init-loader'
                    });
                    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png', 1));
                    if (!blob) throw new Error('Could not create screenshot image');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `finance_snapshot_${new Date().toISOString().slice(0, 10)}.png`;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        if (a.parentNode) a.parentNode.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 30000);
                } finally {
                    stage.classList.remove('active');
                }
            });
            function renderDashWidgets(data) {
                // Recent Activity
                const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
                const recent = sortedData.slice(0, 5);
                document.getElementById('dash-recent-list').innerHTML = recent.map(d => `
                <div class="bg-black/20 p-3 rounded-2xl flex justify-between items-center border border-white/5 hover:border-white/10 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${d.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                            <i class="fas ${d.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        </div>
                        <div>
                            <div class="text-sm font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">${d.desc}</div>
                            <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">${d.date} • ${d.cat}</div>
                        </div>
                    </div>
                    <div class="font-mono text-sm font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                        ${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}
                    </div>
                </div>
            `).join('');
                if (recent.length === 0) document.getElementById('dash-recent-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No activity yet</div>';

                // Top Categories (This Month)
                const now = new Date();
                const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const thisMonthExps = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date.startsWith(thisMonth));

                let totalThisMonth = 0;
                const catTotals = {};
                thisMonthExps.forEach(d => {
                    const amtIDR = d.curr === 'USD' ? d.amt * exchangeRate : d.amt;
                    catTotals[d.cat] = (catTotals[d.cat] || 0) + amtIDR;
                    totalThisMonth += amtIDR;
                });

                const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
                const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E'];

                document.getElementById('dash-top-cat-list').innerHTML = topCats.map((c, i) => {
                    const percentage = totalThisMonth > 0 ? (c[1] / totalThisMonth) * 100 : 0;
                    return `
                <div class="space-y-1.5">
                    <div class="flex justify-between items-end">
                        <span class="text-xs font-bold text-slate-300">${c[0]}</span>
                        <span class="font-mono text-xs text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">${fmt(c[1], 'IDR')}</span>
                    </div>
                    <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full rounded-full" style="width: ${percentage}%; background-color: ${chartColors[i % chartColors.length]}; box-shadow: 0 0 10px ${chartColors[i % chartColors.length]}80;"></div>
                    </div>
                </div>`;
                }).join('');
                if (topCats.length === 0) document.getElementById('dash-top-cat-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No expenses this month</div>';
            }

            document.getElementById('export-csv-btn').addEventListener('click', () => {
                if (masterData.length === 0) { showToast("No data to export", "error"); return; }
                let csvContent = "Type,Date,Description,Category,Account,Currency,Amount\n";
                masterData.forEach(d => {
                    const row = [d.type, d.date, `"${d.desc.replace(/"/g, '""')}"`, `"${d.cat}"`, `"${d.acc}"`, d.curr, d.amt];
                    csvContent += row.join(",") + "\n";
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `finance_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
                showToast("CSV Exported successfully", "success");
            });

            // Settings & AI Receipt Scanner
            let scanProvider = localStorage.getItem('mtracker_scan_provider') || 'groq';

            window.scanSelectProvider = function(p) {
                scanProvider = p;
                localStorage.setItem('mtracker_scan_provider', p);
                const gTab   = document.getElementById('scan-tab-groq');
                const mmTab  = document.getElementById('scan-tab-minimax');
                const gSetup = document.getElementById('scan-setup-groq');
                const mmSetup = document.getElementById('scan-setup-minimax');
                if (!gTab) return;
                if (p === 'groq') {
                    gTab.style.cssText  = 'flex:1;padding:8px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff';
                    mmTab.style.cssText = 'flex:1;padding:8px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8';
                    gSetup.classList.remove('hidden');
                    mmSetup.classList.add('hidden');
                } else {
                    mmTab.style.cssText = 'flex:1;padding:8px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff';
                    gTab.style.cssText  = 'flex:1;padding:8px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8';
                    mmSetup.classList.remove('hidden');
                    gSetup.classList.add('hidden');
                }
            };

            document.getElementById('config-btn').addEventListener('click', () => {
                document.getElementById('groq-api-key').value = localStorage.getItem('groqApiKey') || '';
                const mmScanInp = document.getElementById('minimax-scan-key');
                if (mmScanInp) mmScanInp.value = localStorage.getItem('mtracker_minimax_key') || '';
                // Restore provider tab state
                window.scanSelectProvider(scanProvider);
            });

            const scanBtn = document.getElementById('scan-receipt-btn');
            const uploadInput = document.getElementById('receipt-upload');
            scanBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = scanProvider === 'groq'
                    ? localStorage.getItem('groqApiKey')
                    : localStorage.getItem('mtracker_minimax_key');
                if (!key) {
                    const label = scanProvider === 'groq' ? 'Groq' : 'MiniMax';
                    showToast(`Please save your ${label} API Key in Config first`, 'error');
                    window.switchTab('view-config');
                    return;
                }
                uploadInput.click();
            });

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 8c10c3a9ded903df40e6dbb618b48bac4f506262
            const pasteBtn = document.getElementById('paste-receipt-btn');
            if (pasteBtn) {
                pasteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const key = scanProvider === 'groq' ? localStorage.getItem('groqApiKey') : localStorage.getItem('mtracker_minimax_key');
                    if (!key) {
                        const label = scanProvider === 'groq' ? 'Groq' : 'MiniMax';
                        showToast(`Please save your ${label} API Key in Config first`, 'error');
                        window.switchTab('view-config');
                        return;
                    }
                    try {
                        const clipboardItems = await navigator.clipboard.read();
                        let found = false;
                        for (const clipboardItem of clipboardItems) {
                            for (const type of clipboardItem.types) {
                                if (type.startsWith('image/')) {
                                    const blob = await clipboardItem.getType(type);
                                    processReceiptImage(blob);
                                    found = true;
                                    break;
                                }
                            }
                            if (found) break;
                        }
                        if (!found) showToast('No image found in clipboard!', 'error');
                    } catch (err) {
                        showToast('Failed to read clipboard. You may need to click "Paste" on the popup or use the screen directly.', 'error');
                    }
                });
            }

            document.addEventListener('paste', (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            window.switchTab('view-add');
                            processReceiptImage(blob);
                        }
                        break;
                    }
                }
            });

<<<<<<< HEAD
=======
=======
>>>>>>> 70546160ba44404ff4d95378b76573b5d3499f94
>>>>>>> 8c10c3a9ded903df40e6dbb618b48bac4f506262
            async function processReceiptImage(file) {
                if (!file) return;

                const origHtml = scanBtn.innerHTML;
                scanBtn.innerHTML = '<div class="loader w-4 h-4 border-2 border-emerald-500 border-t-transparent mx-auto"></div>';
                scanBtn.disabled = true;

                try {
                    const base64Img = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let w = img.width, h = img.height;
                                const maxD = 1024;
                                if (w > h && w > maxD) { h *= maxD / w; w = maxD; }
                                else if (h > maxD) { w *= maxD / h; h = maxD; }
                                canvas.width = w; canvas.height = h;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, w, h);
                                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                            };
                            img.onerror = reject;
                            img.src = ev.target.result;
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    const prompt = `You are a receipt data extractor. Analyze this receipt image and extract:
1. Total Amount (number only, no currency symbols)
2. Description (store name or short summary)
3. Date (YYYY-MM-DD format, if not visible return today)
4. Category (choose the most appropriate: Food, Shopping, Transport, Utilities, Health, Entertainment, Error, Transfer, Charity, Salary, Interest, Deposit)
Return ONLY a valid JSON object with this exact structure:
{"amount": 100000, "description": "Store Name", "date": "2024-05-05", "category": "Food"}
Do not wrap in markdown or code blocks.`;

                    let endpoint, model, apiKey, headers;
                    if (scanProvider === 'minimax') {
                        apiKey   = localStorage.getItem('mtracker_minimax_key');
                        const mmModelEl = document.getElementById('scan-model-minimax');
                        model    = mmModelEl ? mmModelEl.value : 'MiniMax-M2.5';
                        endpoint = 'https://api.minimax.io/v1/chat/completions';
                        headers  = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    } else {
                        apiKey   = localStorage.getItem('groqApiKey');
                        model    = 'meta-llama/llama-4-scout-17b-16e-instruct';
                        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
                        headers  = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    }

                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            model,
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Img}` } },
                                    { type: 'text', text: prompt }
                                ]
                            }],
                            temperature: 0.1,
                            max_tokens: 512
                        })
                    });

                    if (res.status === 429) throw new Error('Rate Limit Exceeded. Please try again shortly.');
                    if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        const errMsg = errData && errData.error ? errData.error.message : await res.text();
                        throw new Error(`API Error (${res.status}): ${errMsg}`);
                    }
                    const data = await res.json();
                    let text = data.choices[0].message.content.trim();
                    // Strip think tags from reasoning models
                    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                    if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();

                    const parsed = JSON.parse(text);

                    if (parsed.amount) document.getElementById('entry-amt-source').value = parsed.amount;
                    if (parsed.description) document.getElementById('entry-desc').value = parsed.description;
                    if (parsed.date && parsed.date.length === 10) document.getElementById('entry-date').value = parsed.date;

                    if (parsed.category) {
                        const catSelect = document.getElementById('entry-cat');
                        if ([...catSelect.options].map(o => o.value).includes(parsed.category)) {
                            catSelect.value = parsed.category;
                            document.getElementById('entry-cat-other').classList.add('hidden');
                        } else {
                            catSelect.value = 'Other';
                            document.getElementById('entry-cat-other').classList.remove('hidden');
                            document.getElementById('entry-cat-other').style.display = 'block';
                            document.getElementById('entry-cat-other').value = parsed.category;
                        }
                    }
                    const label = scanProvider === 'minimax' ? 'MiniMax' : 'Groq';
                    showToast(`Receipt scanned via ${label}!`, 'success');
                } catch (err) {
                    console.error(err);
                    showToast('Failed to scan receipt: ' + err.message, 'error');
                } finally {
                    scanBtn.innerHTML = origHtml;
                    scanBtn.disabled = false;
                    uploadInput.value = '';
                }
            }

            uploadInput.addEventListener('change', async (e) => {
                await processReceiptImage(e.target.files[0]);
            });

            document.addEventListener('paste', async (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file') {
                        const blob = item.getAsFile();
                        if (blob && blob.type.startsWith('image/')) {
                            const key = scanProvider === 'groq'
                                ? localStorage.getItem('groqApiKey')
                                : localStorage.getItem('mtracker_minimax_key');
                            if (!key) {
                                const label = scanProvider === 'groq' ? 'Groq' : 'MiniMax';
                                showToast(`Please save your ${label} API Key in Config first`, 'error');
                                window.switchTab('view-config');
                                return;
                            }
                            window.switchTab('view-add');
                            await processReceiptImage(blob);
                            break;
                        }
                    }
                }
            });
            // Reconcile Balances Feature
            window.openReconcileModal = function () {
                const bals = {};
                masterData.forEach(d => {
                    const k = `${d.acc}-${d.curr}`;
                    if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
                    if (d.type === 'income') bals[k].v += d.amt;
                    else bals[k].v -= d.amt;
                });

                const listEl = document.getElementById('reconcile-list');
                listEl.innerHTML = Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).map((b, idx) => {
                    return `
                    <div class="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex-shrink-0">
                            <div class="font-bold text-slate-200">${b.n}</div>
                            <div class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">App: ${fmt(b.v, b.c)}</div>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                            <div class="relative flex-grow sm:flex-grow-0">
                                <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 font-bold text-xs">${b.c}</span>
                                <input type="number" id="rec-real-${idx}" placeholder="Real Balance" class="input-glow rounded-xl pl-12 pr-4 py-2 w-full sm:w-[160px] text-sm text-white font-mono" oninput="updateReconcileDiff(${idx}, ${b.v}, '${b.c}', '${b.n}')">
                            </div>
                            <div id="rec-diff-container-${idx}" class="hidden flex items-center justify-between sm:justify-start gap-3 mt-2 sm:mt-0 bg-black/40 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                                <span id="rec-diff-${idx}" class="font-bold text-sm font-mono whitespace-nowrap min-w-[80px] text-right"></span>
                                <button id="rec-btn-${idx}" class="hidden bg-theme-primary/20 hover:bg-theme-primary/40 text-theme-primaryLight border border-theme-primary/30 px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition" onclick="createAdjustment(${idx}, '${b.n}', '${b.c}')">Adjust</button>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');

                document.getElementById('reconcile-modal').classList.remove('hidden');
            };

            window.updateReconcileDiff = function (idx, appVal, curr, accName) {
                const realInput = document.getElementById(`rec-real-${idx}`).value;
                const container = document.getElementById(`rec-diff-container-${idx}`);
                const diffEl = document.getElementById(`rec-diff-${idx}`);
                const btnEl = document.getElementById(`rec-btn-${idx}`);

                if (realInput === '') {
                    container.classList.add('hidden');
                    return;
                }

                const realVal = parseFloat(realInput);
                const diff = realVal - appVal;

                container.classList.remove('hidden');

                if (diff === 0) {
                    diffEl.innerHTML = '<i class="fas fa-check text-emerald-500 mr-1"></i> Match';
                    diffEl.className = 'font-bold text-sm font-mono whitespace-nowrap min-w-[80px] text-right text-slate-400';
                    btnEl.classList.add('hidden');
                } else {
                    diffEl.textContent = (diff > 0 ? '+' : '') + fmt(diff, curr);
                    diffEl.className = `font-bold text-sm font-mono whitespace-nowrap min-w-[80px] text-right ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`;

                    btnEl.classList.remove('hidden');
                    btnEl.dataset.diff = diff;
                }
            };

            window.createAdjustment = function (idx, acc, curr) {
                const diff = parseFloat(document.getElementById(`rec-btn-${idx}`).dataset.diff);
                const type = diff > 0 ? 'income' : 'expense';
                const amt = Math.abs(diff);
                const date = new Date().toISOString().split('T')[0];

                const payload = {
                    action: 'add',
                    sheetName: type === 'income' ? 'Income' : 'Expenses',
                    date: date,
                    description: "Reconciliation Adjustment",
                    category: "Error",
                    account: acc,
                    currency: curr,
                    amount: amt
                };

                const btn = document.getElementById(`rec-btn-${idx}`);
                const origHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btn.disabled = true;

                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }).then(r => r.json()).then(res => {
                    if (res.status === 'success') {
                        showToast(`Adjustment created: ${type === 'income' ? '+' : '-'}${fmt(amt, curr)}`, 'success');
                        fetchData().then(() => {
                            openReconcileModal();
                        });
                    } else {
                        showToast("Failed to create adjustment", 'error');
                        btn.innerHTML = origHtml;
                        btn.disabled = false;
                    }
                }).catch(e => {
                    showToast("Error: " + e.message, 'error');
                    btn.innerHTML = origHtml;
                    btn.disabled = false;
                });
            };

            // --- SYSTEM CONFIG TAB LOGIC ---
            document.getElementById('config-btn').addEventListener('click', () => renderConfigUI());

            window.renderConfigUI = renderConfigUI;
            function renderConfigUI() {
                const container = document.getElementById('config-sections-container');
                const sections = [
                    { title: "Expense Categories", key: "exp", color: "rose", icon: "fa-tags" },
                    { title: "Income Categories", key: "inc", color: "emerald", icon: "fa-tags" },
                    { title: "IDR Wallets", key: "walletsIDR", color: "blue", icon: "fa-wallet" },
                    { title: "USD Wallets", key: "walletsUSD", color: "teal", icon: "fa-dollar-sign" },
                    { title: "Investment Accounts (Names)", key: "investmentAccounts", color: "purple", icon: "fa-chart-line" }
                ];

                let html = '';
                sections.forEach(s => {
                    if (!SYSTEM_CONFIG[s.key]) SYSTEM_CONFIG[s.key] = [];
                    const list = SYSTEM_CONFIG[s.key];
                    
                    let inputHtml = '';
                    if (s.key === 'investmentAccounts') {
                        const allWallets = [...(SYSTEM_CONFIG.walletsIDR || []), ...(SYSTEM_CONFIG.walletsUSD || [])];
                        const availableWallets = allWallets.filter(w => !list.includes(w));
                        const options = availableWallets.map(w => `<option value="${w}">${w}</option>`).join('');
                        inputHtml = `
                            <select id="config-new-${s.key}" class="flex-grow input-glow bg-black/40 rounded-xl px-3 py-2 text-xs text-slate-100 appearance-none">
                                ${options ? options : '<option value="" disabled selected>No wallets available</option>'}
                            </select>
                        `;
                    } else {
                        inputHtml = `<input type="text" id="config-new-${s.key}" class="flex-grow input-glow bg-black/40 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600" placeholder="New item...">`;
                    }

                    html += `
                        <div class="glass-card p-5 rounded-2xl border border-white/5 bg-black/20 flex flex-col">
                            <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4"><i class="fas ${s.icon} mr-2 text-${s.color}-400"></i> ${s.title}</h3>
                            <div class="flex-grow flex flex-wrap gap-2 mb-4">
                                ${list.map((item, idx) => `
                                    <div class="bg-${s.color}-500/10 text-${s.color}-400 border border-${s.color}-500/20 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                        ${item} <button onclick="removeConfigItem('${s.key}', ${idx})" class="hover:text-white transition"><i class="fas fa-times"></i></button>
                                    </div>
                                `).join('')}
                                ${list.length === 0 ? `<span class="text-xs text-slate-500 italic">Empty</span>` : ''}
                            </div>
                            <div class="flex gap-2 mt-auto">
                                ${inputHtml}
                                <button onclick="addConfigItem('${s.key}')" class="bg-${s.color}-600 hover:bg-${s.color}-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-md"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = html;

                // Render allowed emails
                const emailList = SYSTEM_CONFIG.allowedEmails || [];
                document.getElementById('config-allowed-emails-list').innerHTML = emailList.map((em, idx) => `
                    <div class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                        ${em} <button onclick="removeConfigEmail(${idx})" class="hover:text-white transition"><i class="fas fa-times"></i></button>
                    </div>
                `).join('') || '<span class="text-xs text-slate-500 italic">No restriction — anyone can sign in</span>';
            }

            window.removeConfigItem = function (key, index) {
                SYSTEM_CONFIG[key].splice(index, 1);
                renderConfigUI();
            };

            window.removeConfigEmail = function (index) {
                SYSTEM_CONFIG.allowedEmails.splice(index, 1);
                renderConfigUI();
            };

            window.addConfigEmail = function () {
                const input = document.getElementById('config-new-email');
                const val = input.value.trim().toLowerCase();
                if (!SYSTEM_CONFIG.allowedEmails) SYSTEM_CONFIG.allowedEmails = [];
                if (val && !SYSTEM_CONFIG.allowedEmails.includes(val)) {
                    SYSTEM_CONFIG.allowedEmails.push(val);
                    input.value = '';
                    renderConfigUI();
                } else if (SYSTEM_CONFIG.allowedEmails.includes(val)) {
                    showToast("Email already in list!", "error");
                }
            };

            window.addConfigItem = function (key) {
                const input = document.getElementById(`config-new-${key}`);
                const val = input.value.trim();
                if (val && !SYSTEM_CONFIG[key].includes(val)) {
                    SYSTEM_CONFIG[key].push(val);
                    renderConfigUI();
                } else if (SYSTEM_CONFIG[key].includes(val)) {
                    showToast("Item already exists!", "error");
                }
            };

            document.getElementById('save-config-btn').addEventListener('click', () => {
                const btn = document.getElementById('save-config-btn');
                const origTxt = btn.innerHTML;

                SYSTEM_CONFIG.pin = null; // PIN removed, using Google Auth

                // Also save the Groq API key
                const groqKey = document.getElementById('groq-api-key').value.trim();
                if (groqKey) localStorage.setItem('groqApiKey', groqKey);

                // Also save MiniMax scan key if filled
                const mmScanKeyEl = document.getElementById('minimax-scan-key');
                if (mmScanKeyEl && mmScanKeyEl.value.trim()) {
                    localStorage.setItem('mtracker_minimax_key', mmScanKeyEl.value.trim());
                }

                btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent mx-auto"></div>';
                btn.disabled = true;

                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'updateSystemConfig', config: SYSTEM_CONFIG })
                }).then(r => r.json()).then(d => {
                    if (d.status === 'success') {
                        showToast("Configuration Saved! Reloading...", 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    } else throw new Error(d.message);
                }).catch(e => showToast("Error: " + e.message, 'error')).finally(() => {
                    btn.innerHTML = origTxt;
                    btn.disabled = false;
                });
            });

            // ============================================================
            // MONTHLY BUDGET FEATURE — Synced to Google Sheets (Budget tab)
            // ============================================================
            let budgetViewDate = new Date();
            let allBudgets = {}; // Cache: { "2025-05": { Food: 500000 } }
            let budgetLoaded = false;

            function getBudgetMonthKey(date) {
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            function getBudgetsForMonth(date) {
                return allBudgets[getBudgetMonthKey(date)] || {};
            }

            async function loadBudgetsFromSheets() {
                try {
                    const res = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getBudgets' }) });
                    const result = await res.json();
                    console.log('[Budget] Response from sheet:', result);
                    if (result.status === 'success') {
                        // Normalize keys: Sheets may return Date-based keys ("Sat Apr 30 2026...") instead of "YYYY-MM"
                        // This handles both old (pre-normalizeMonth deploy) and new data
                        const raw = result.budgets || {};
                        const normalized = {};
                        Object.entries(raw).forEach(([key, cats]) => {
                            const normKey = normalizeMonthClient(key);
                            if (!normalized[normKey]) normalized[normKey] = {};
                            Object.assign(normalized[normKey], cats);
                        });
                        allBudgets = normalized;
                        budgetLoaded = true;
                        console.log('[Budget] Loaded (normalized):', allBudgets);
                    } else {
                        console.warn('[Budget] Error from script:', result.message);
                    }
                } catch (e) {
                    console.warn('[Budget] Failed to load budgets:', e);
                }
            }

            // Normalizes a month key from Sheets — handles both "YYYY-MM" strings and Date-like strings
            function normalizeMonthClient(val) {
                // If it's already in YYYY-MM format, return as-is
                if (/^\d{4}-\d{2}$/.test(String(val).trim())) return String(val).trim();
                // Otherwise try to parse as a date
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
                return String(val).trim();
            }

            async function saveBudgetToSheets(date, cat, amount) {
                const month = getBudgetMonthKey(date);
                // Optimistic update in cache
                if (!allBudgets[month]) allBudgets[month] = {};
                if (amount <= 0) delete allBudgets[month][cat];
                else allBudgets[month][cat] = amount;

                try {
                    const res = await fetch(WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'setBudget', month, category: cat, amount })
                    });
                    const result = await res.json();
                    if (result.status !== 'success') throw new Error(result.message);
                } catch (e) {
                    showToast('Failed to save budget: ' + e.message, 'error');
                }
            }

            function getSpentByCategory(date) {
                const key = getBudgetMonthKey(date);
                const spent = {};
                masterData.forEach(d => {
                    if (d.type === 'expense' && d.cat !== 'Transfer' && d.date.startsWith(key)) {
                        const amtIDR = d.curr === 'USD' ? d.amt * exchangeRate : d.amt;
                        spent[d.cat] = (spent[d.cat] || 0) + amtIDR;
                    }
                });
                return spent;
            }

            function renderBudgetView() {
                const budgets = getBudgetsForMonth(budgetViewDate);
                const spent = getSpentByCategory(budgetViewDate);

                // Update month header
                document.getElementById('budget-header').textContent = budgetViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

                // Compute totals
                const budgetedCats = Object.keys(budgets);
                const totalLimit = budgetedCats.reduce((s, c) => s + budgets[c], 0);
                const totalSpent = budgetedCats.reduce((s, c) => s + (spent[c] || 0), 0);
                const totalRemaining = totalLimit - totalSpent;
                const overallPct = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;

                document.getElementById('budget-total-limit').textContent = fmt(totalLimit, 'IDR');
                document.getElementById('budget-total-spent').textContent = fmt(totalSpent, 'IDR');

                const remainEl = document.getElementById('budget-total-remaining');
                remainEl.textContent = fmt(Math.abs(totalRemaining), 'IDR');
                remainEl.className = `font-bold font-mono text-sm ${totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
                if (totalRemaining < 0) remainEl.textContent = '- ' + remainEl.textContent;

                // Overall bar
                const bar = document.getElementById('budget-overall-bar');
                const pctLabel = document.getElementById('budget-overall-pct');
                bar.style.width = overallPct + '%';
                pctLabel.textContent = Math.round(overallPct) + '%';
                if (overallPct >= 100) {
                    bar.style.background = 'linear-gradient(90deg, #f43f5e, #e11d48)';
                    bar.style.boxShadow = '0 0 10px rgba(244,63,94,0.5)';
                    pctLabel.className = 'text-xs font-mono font-bold text-rose-400';
                } else if (overallPct >= 75) {
                    bar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
                    bar.style.boxShadow = '0 0 10px rgba(245,158,11,0.4)';
                    pctLabel.className = 'text-xs font-mono font-bold text-amber-400';
                } else {
                    bar.style.background = 'linear-gradient(90deg, #4f46e5, #06b6d4)';
                    bar.style.boxShadow = '0 0 10px rgba(79,70,229,0.4)';
                    pctLabel.className = 'text-xs font-mono font-bold text-white';
                }

                // Category budget list
                const listEl = document.getElementById('budget-list');
                const emptyEl = document.getElementById('budget-empty');

                if (budgetedCats.length === 0) {
                    listEl.innerHTML = '';
                    emptyEl.classList.remove('hidden');
                } else {
                    emptyEl.classList.add('hidden');
                    listEl.innerHTML = budgetedCats.sort().map(cat => {
                        const limit = budgets[cat];
                        const catSpent = spent[cat] || 0;
                        const pct = Math.min((catSpent / limit) * 100, 100);
                        const remaining = limit - catSpent;
                        const isOver = catSpent > limit;
                        const isWarning = pct >= 75;

                        let barColor, barGlow, statusClass, statusText;
                        if (isOver) {
                            barColor = 'linear-gradient(90deg, #f43f5e, #e11d48)';
                            barGlow = '0 0 8px rgba(244,63,94,0.5)';
                            statusClass = 'text-rose-400';
                            statusText = `Over by ${fmt(catSpent - limit, 'IDR')}`;
                        } else if (isWarning) {
                            barColor = 'linear-gradient(90deg, #f59e0b, #d97706)';
                            barGlow = '0 0 8px rgba(245,158,11,0.4)';
                            statusClass = 'text-amber-400';
                            statusText = `${fmt(remaining, 'IDR')} left`;
                        } else {
                            barColor = 'linear-gradient(90deg, #4f46e5, #06b6d4)';
                            barGlow = '0 0 8px rgba(79,70,229,0.4)';
                            statusClass = 'text-emerald-400';
                            statusText = `${fmt(remaining, 'IDR')} left`;
                        }

                        return `
                        <div class="space-y-2 bg-black/20 p-4 rounded-2xl border border-white/5 group hover:border-white/10 transition">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    ${isOver ? '<i class="fas fa-exclamation-circle text-rose-400 text-xs"></i>' : isWarning ? '<i class="fas fa-exclamation-triangle text-amber-400 text-xs"></i>' : '<i class="fas fa-check-circle text-emerald-500/60 text-xs"></i>'}
                                    <span class="text-sm font-bold text-slate-200">${cat}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs ${statusClass} font-mono font-bold">${statusText}</span>
                                    <button class="budget-delete-btn opacity-0 group-hover:opacity-100 transition text-slate-600 hover:text-rose-400 text-xs" data-cat="${cat}">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <div class="h-full rounded-full transition-all duration-700 ease-out" style="width: ${pct}%; background: ${barColor}; box-shadow: ${barGlow};"></div>
                            </div>
                            <div class="flex justify-between text-[10px] text-slate-500 font-mono">
                                <span>${fmt(catSpent, 'IDR')} spent</span>
                                <span>Limit: ${fmt(limit, 'IDR')}</span>
                            </div>
                        </div>`;
                    }).join('');

                    // Wire up delete buttons
                    listEl.querySelectorAll('.budget-delete-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            await saveBudgetToSheets(budgetViewDate, btn.dataset.cat, 0);
                            renderBudgetView();
                            showToast(`Budget for "${btn.dataset.cat}" removed`, 'success');
                        });
                    });
                }

                // Unbudgeted spending
                const untrackedEl = document.getElementById('budget-untracked-list');
                const untrackedEmptyEl = document.getElementById('budget-untracked-empty');
                const untrackedCats = Object.entries(spent).filter(([cat]) => !budgets[cat]);
                if (untrackedCats.length === 0) {
                    untrackedEl.innerHTML = '';
                    untrackedEmptyEl.classList.remove('hidden');
                } else {
                    untrackedEmptyEl.classList.add('hidden');
                    untrackedEl.innerHTML = untrackedCats.sort((a, b) => b[1] - a[1]).map(([cat, val]) => `
                        <div class="flex items-center justify-between py-2.5 px-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition">
                            <span class="text-sm text-slate-300 font-medium">${cat}</span>
                            <div class="flex items-center gap-2">
                                <span class="font-mono text-sm font-bold text-amber-400">${fmt(val, 'IDR')}</span>
                                <button class="budget-quick-add text-[10px] bg-theme-primary/20 hover:bg-theme-primary/30 text-theme-primaryLight px-2 py-1 rounded-md border border-theme-primary/30 font-bold transition" data-cat="${cat}" data-amt="${Math.round(val)}">
                                    + Budget
                                </button>
                            </div>
                        </div>`).join('');

                    untrackedEl.querySelectorAll('.budget-quick-add').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const form = document.getElementById('budget-form');
                            form.classList.remove('hidden');
                            // Populate category select from system config
                            const sel = document.getElementById('budget-cat-select');
                            const cats = SYSTEM_CONFIG.exp || [];
                            sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
                            sel.value = btn.dataset.cat;
                            document.getElementById('budget-amount-input').value = btn.dataset.amt;
                            document.getElementById('budget-amount-input').focus();
                        });
                    });
                }
            }

            // Budget month navigation
            document.getElementById('budget-prev-month').addEventListener('click', () => {
                budgetViewDate.setMonth(budgetViewDate.getMonth() - 1);
                renderBudgetView();
            });
            document.getElementById('budget-next-month').addEventListener('click', () => {
                budgetViewDate.setMonth(budgetViewDate.getMonth() + 1);
                renderBudgetView();
            });

            // Budget add form toggle
            document.getElementById('budget-add-btn').addEventListener('click', () => {
                const form = document.getElementById('budget-form');
                form.classList.toggle('hidden');
                if (!form.classList.contains('hidden')) {
                    const sel = document.getElementById('budget-cat-select');
                    const cats = SYSTEM_CONFIG.exp || [];
                    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
                    document.getElementById('budget-amount-input').value = '';
                    document.getElementById('budget-amount-input').focus();
                }
            });
            document.getElementById('budget-cancel-btn').addEventListener('click', () => {
                document.getElementById('budget-form').classList.add('hidden');
            });
            document.getElementById('budget-save-btn').addEventListener('click', async () => {
                const btn = document.getElementById('budget-save-btn');
                const cat = document.getElementById('budget-cat-select').value;
                const amt = parseFloat(document.getElementById('budget-amount-input').value);
                if (!cat || isNaN(amt) || amt <= 0) { showToast('Please enter a valid amount', 'error'); return; }
                const origTxt = btn.textContent;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btn.disabled = true;
                await saveBudgetToSheets(budgetViewDate, cat, amt);
                document.getElementById('budget-form').classList.add('hidden');
                renderBudgetView();
                showToast(`Budget set for ${cat}`, 'success');
                btn.innerHTML = origTxt;
                btn.disabled = false;
            });

            // --- Copy Budget From Month ---
            document.getElementById('budget-copy-btn').addEventListener('click', () => {
                const currentKey = getBudgetMonthKey(budgetViewDate);
                const otherMonths = Object.keys(allBudgets)
                    .filter(k => k !== currentKey && Object.keys(allBudgets[k]).length > 0)
                    .sort().reverse(); // most recent first

                const listEl = document.getElementById('copy-month-list');
                const emptyEl = document.getElementById('copy-month-empty');

                if (otherMonths.length === 0) {
                    listEl.innerHTML = '';
                    emptyEl.classList.remove('hidden');
                } else {
                    emptyEl.classList.add('hidden');
                    listEl.innerHTML = otherMonths.map(month => {
                        const cats = allBudgets[month];
                        const catCount = Object.keys(cats).length;
                        const [y, m] = month.split('-');
                        const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                        return `
                        <button class="copy-month-pick w-full flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5 hover:border-theme-primary/40 hover:bg-theme-primary/10 transition group" data-month="${month}">
                            <div class="text-left">
                                <div class="text-sm font-bold text-white group-hover:text-theme-primaryLight transition">${label}</div>
                                <div class="text-[10px] text-slate-500 mt-0.5">${catCount} categor${catCount === 1 ? 'y' : 'ies'}: ${Object.keys(cats).join(', ')}</div>
                            </div>
                            <i class="fas fa-arrow-right text-slate-600 group-hover:text-theme-primaryLight text-xs transition"></i>
                        </button>`;
                    }).join('');

                    listEl.querySelectorAll('.copy-month-pick').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const srcMonth = btn.dataset.month;
                            const srcBudgets = allBudgets[srcMonth] || {};
                            const cats = Object.keys(srcBudgets);
                            if (cats.length === 0) return;

                            document.getElementById('copy-month-modal').classList.add('hidden');
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                            // Copy each category one by one
                            for (const cat of cats) {
                                await saveBudgetToSheets(budgetViewDate, cat, srcBudgets[cat]);
                            }
                            renderBudgetView();
                            showToast(`Copied ${cats.length} budget${cats.length > 1 ? 's' : ''} from ${btn.querySelector('div > div').textContent}`, 'success');
                        });
                    });
                }

                document.getElementById('copy-month-modal').classList.remove('hidden');
            });

            document.getElementById('copy-month-close').addEventListener('click', () => {
                document.getElementById('copy-month-modal').classList.add('hidden');
            });

            // Load budgets from Sheets when switching to Budget tab, only if not yet loaded
            async function onBudgetTabOpen() {
                if (!budgetLoaded) {
                    document.getElementById('budget-list').innerHTML = '<div class="text-center py-6 text-slate-500 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading budgets...</div>';
                    await loadBudgetsFromSheets();
                }
                renderBudgetView();
            }

            deskNavBtns.forEach(b => { if (b.dataset.target === 'view-budget') b.addEventListener('click', onBudgetTabOpen); });
            mobNavBtns.forEach(b => { if (b.dataset.target === 'view-budget') b.addEventListener('click', onBudgetTabOpen); });

        });

        // ============================================================
        // AI FINANCE ASSISTANT
        // ============================================================
        document.addEventListener('DOMContentLoaded', function () {
        (function () {
            const GROQ_KEY    = 'mtracker_groq_key';
            const MINIMAX_KEY  = 'mtracker_minimax_key';
            const PROVIDER_KEY = 'mtracker_ai_provider';
            let aiChatHistory = [];
            let currentProvider = localStorage.getItem('mtracker_ai_provider') || 'groq';

            const panel      = document.getElementById('ai-panel');
            const backdrop   = document.getElementById('ai-backdrop');
            const messagesEl = document.getElementById('ai-messages');
            const inputEl    = document.getElementById('ai-input');
            const sendBtn    = document.getElementById('ai-send-btn');
            const keySetup   = document.getElementById('ai-key-setup');
            const suggestEl  = document.getElementById('ai-suggestions');

            function getKey(p) {
                p = p || currentProvider;
                return localStorage.getItem(p === 'groq' ? GROQ_KEY : MINIMAX_KEY) || '';
            }

            window.aiSelectProvider = function(p) {
                currentProvider = p;
                localStorage.setItem(PROVIDER_KEY, p);
                const groqTab   = document.getElementById('ai-tab-groq');
                const mmTab     = document.getElementById('ai-tab-minimax');
                const groqSetup = document.getElementById('ai-setup-groq');
                const mmSetup   = document.getElementById('ai-setup-minimax');
                if (!groqTab || !mmTab) return;
                if (p === 'groq') {
                    groqTab.style.cssText = 'flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff';
                    mmTab.style.cssText   = 'flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8';
                    if (groqSetup) { groqSetup.classList.remove('hidden'); groqSetup.style.display = 'flex'; }
                    if (mmSetup)   { mmSetup.classList.add('hidden'); mmSetup.style.display = 'none'; }
                } else {
                    mmTab.style.cssText   = 'flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff';
                    groqTab.style.cssText = 'flex:1;padding:10px 0;font-size:.75rem;font-weight:700;background:rgba(255,255,255,.05);color:#94a3b8';
                    if (mmSetup)   { mmSetup.classList.remove('hidden'); mmSetup.style.display = 'flex'; }
                    if (groqSetup) { groqSetup.classList.add('hidden'); groqSetup.style.display = 'none'; }
                }
            };

            function updateProviderBadge() {
                const badge = document.getElementById('ai-provider-badge');
                if (!badge) return;
                if (currentProvider === 'groq') {
                    badge.textContent = 'Powered by Groq • Llama 3.3';
                    badge.style.color = 'rgba(167,139,250,.7)';
                } else {
                    const mmSel = document.getElementById('ai-model-minimax');
                    const mmName = mmSel ? mmSel.value : 'MiniMax-M2.5';
                    badge.textContent = `Powered by MiniMax \u2022 ${mmName}`;
                    badge.style.color = 'rgba(34,211,238,.7)';
                }
            }

            function openPanel() {
                panel.classList.remove('translate-x-full');
                backdrop.classList.remove('hidden');
                document.getElementById('ai-chat-btn').classList.add('scale-0', 'opacity-0', 'pointer-events-none');
                updateProviderBadge();
                window.aiSelectProvider(currentProvider);
                const key = getKey();
                if (!key) {
                    keySetup.classList.remove('hidden');
                    keySetup.style.display = 'flex';
                    messagesEl.classList.add('hidden');
                    suggestEl.classList.add('hidden');
                } else {
                    keySetup.style.display = 'none';
                    keySetup.classList.add('hidden');
                    messagesEl.classList.remove('hidden');
                    suggestEl.classList.toggle('hidden', aiChatHistory.length > 0);
                }
                setTimeout(() => inputEl.focus(), 350);
            }

            function closePanel() {
                panel.classList.add('translate-x-full');
                backdrop.classList.add('hidden');
                document.getElementById('ai-chat-btn').classList.remove('scale-0', 'opacity-0', 'pointer-events-none');
            }

            document.getElementById('ai-chat-btn').addEventListener('click', openPanel);
            document.getElementById('ai-close-btn').addEventListener('click', closePanel);
            backdrop.addEventListener('click', closePanel);

            // API Key save
            document.getElementById('ai-key-save-btn').addEventListener('click', () => {
                const inputId = currentProvider === 'groq' ? 'ai-key-groq' : 'ai-key-minimax';
                const keyInput = document.getElementById(inputId);
                const key = keyInput ? keyInput.value.trim() : '';
                if (!key) return;
                localStorage.setItem(currentProvider === 'groq' ? GROQ_KEY : MINIMAX_KEY, key);
                keySetup.style.display = 'none';
                keySetup.classList.add('hidden');
                messagesEl.classList.remove('hidden');
                suggestEl.classList.remove('hidden');
                updateProviderBadge();
                const label = currentProvider === 'groq' ? 'Groq (Llama 3.3)' : 'MiniMax';
                addMessage('model', `Hi! I'm your AI Finance Assistant \U0001f44b Connected via **${label}**. Ask me anything about your spending, income, trends, or budgets!`);
            });

            // Settings: re-show provider setup
            document.getElementById('ai-settings-btn').addEventListener('click', () => {
                window.aiSelectProvider(currentProvider);
                // Pre-fill existing keys
                const gInp = document.getElementById('ai-key-groq');
                const mInp = document.getElementById('ai-key-minimax');
                if (gInp) gInp.value = getKey('groq');
                if (mInp) mInp.value = getKey('minimax');
                keySetup.style.display = 'flex';
                keySetup.classList.remove('hidden');
                messagesEl.classList.add('hidden');
                suggestEl.classList.add('hidden');
            });

            // Clear chat
            document.getElementById('ai-clear-btn').addEventListener('click', () => {
                aiChatHistory = [];
                messagesEl.innerHTML = '';
                suggestEl.classList.remove('hidden');
            });

            // Suggestions
            document.querySelectorAll('.ai-suggestion').forEach(btn => {
                btn.addEventListener('click', () => {
                    const text = btn.textContent.replace(/^[^\s]+\s/, '').replace('?', '').trim() + '?';
                    sendMessage(text.charAt(0).toUpperCase() + text.slice(1));
                });
            });

            // Auto-resize textarea
            inputEl.addEventListener('input', () => {
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
            });

            inputEl.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); triggerSend(); }
            });
            sendBtn.addEventListener('click', triggerSend);

            function triggerSend() {
                const text = inputEl.value.trim();
                if (!text) return;
                inputEl.value = '';
                inputEl.style.height = 'auto';
                sendMessage(text);
            }

            function addMessage(role, text, isLoading = false) {
                suggestEl.classList.add('hidden');
                const isUser = role === 'user';
                const div = document.createElement('div');
                div.className = `flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`;

                const bubble = document.createElement('div');
                bubble.className = isUser
                    ? 'max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm text-white leading-relaxed'
                    : 'max-w-[88%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm text-slate-200 leading-relaxed';
                bubble.style.background = isUser
                    ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                    : 'rgba(255,255,255,0.05)';
                bubble.style.border = isUser ? 'none' : '1px solid rgba(255,255,255,0.08)';

                if (isLoading) {
                    bubble.innerHTML = '<span class="inline-flex gap-1 items-center"><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:0ms"></span><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:150ms"></span><span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style="animation-delay:300ms"></span></span>';
                    div.id = 'ai-loading-bubble';
                } else {
                    // Render simple markdown: **bold**, *italic*, newlines
                    bubble.innerHTML = text
                        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                        .replace(/\*\*(.+?)\*\*/g,'<strong class="text-white">$1</strong>')
                        .replace(/\*(.+?)\*/g,'<em>$1</em>')
                        .replace(/`(.+?)`/g,'<code class="bg-black/40 px-1 rounded text-violet-300 text-xs font-mono">$1</code>')
                        .replace(/\n/g,'<br>');
                }

                div.appendChild(bubble);
                messagesEl.appendChild(div);
                messagesEl.scrollTop = messagesEl.scrollHeight;
                return div;
            }

            function buildDataContext() {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const data = window.masterData || [];

                const header = `You are a personal finance assistant for MTracker app.
Today's date: ${todayStr}
Exchange rate: 1 USD = ${window.exchangeRate || 16000} IDR
Currency: Primary is IDR (Indonesian Rupiah).`;

                const instructions = `Instructions:
- Format IDR amounts with commas, e.g. IDR 1,234,567.
- "Last week" = Mon-Sun of the previous calendar week.
- Be concise and friendly. Say honestly if data is unavailable.`;

                if (currentProvider === 'minimax') {
                    // MiniMax M2 has 204,800 token context — send ALL transactions
                    const allTx = data
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(d => `${d.date}|${d.type}|${d.desc}|${d.cat}|${d.acc}|${d.curr}|${d.amt}`)
                        .join('\n') || '(none)';

                    return `${header}

== ALL TRANSACTIONS (complete history) ==
Format: date|type|description|category|account|currency|amount
${allTx}

${instructions}
- You have the user's FULL transaction history. Use it for any time range or deep analysis.`;

                } else {
                    // Groq: 12k TPM limit — send last 3 months raw + all-time monthly summary
                    const cutoff3m = new Date(today);
                    cutoff3m.setMonth(cutoff3m.getMonth() - 3);
                    const cutoff3mStr = cutoff3m.toISOString().split('T')[0];

                    const recentTx = data
                        .filter(d => d.date >= cutoff3mStr)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(d => `${d.date}|${d.type}|${d.desc}|${d.cat}|${d.curr}|${d.amt}`)
                        .join('\n') || '(none)';

                    const monthlySummary = {};
                    data.forEach(d => {
                        const month = d.date.slice(0, 7);
                        const key = `${month}|${d.type}|${d.cat}|${d.curr}`;
                        monthlySummary[key] = (monthlySummary[key] || 0) + d.amt;
                    });
                    const summaryLines = Object.entries(monthlySummary)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([k, v]) => `${k}|${Math.round(v)}`)
                        .join('\n') || '(none)';

                    return `${header}

== RECENT TRANSACTIONS (last 3 months) ==
Format: date|type|description|category|currency|amount
${recentTx}

== MONTHLY SUMMARY (all time, aggregated) ==
Format: month|type|category|currency|total_amount
${summaryLines}

${instructions}
- For specific lookups, use RECENT TRANSACTIONS. For trends, use MONTHLY SUMMARY.`;
                }
            }


            async function sendMessage(text) {
                if (!getKey()) { openPanel(); return; }

                aiChatHistory.push({ role: 'user', text });
                addMessage('user', text);

                const loadingEl = addMessage('model', '', true);
                loadingEl.id = 'ai-loading-bubble';
                sendBtn.disabled = true;

                try {
                    const systemCtx = buildDataContext();
                    // Provider-aware API call
                    const isGroq = currentProvider === 'groq';
                    const endpoint = isGroq
                        ? 'https://api.groq.com/openai/v1/chat/completions'
                        : 'https://api.minimax.io/v1/chat/completions';
                    const mmModelEl = document.getElementById('ai-model-minimax');
                    const mmModel = mmModelEl ? mmModelEl.value : 'MiniMax-M2.5';
                    const model = isGroq ? 'llama-3.3-70b-versatile' : mmModel;

                    const messages = [
                        { role: 'system', content: systemCtx },
                        ...aiChatHistory.map(m => ({
                            role: m.role === 'model' ? 'assistant' : m.role,
                            content: m.text
                        }))
                    ];

                    const res = await fetch(
                        endpoint,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${getKey()}`
                            },
                            body: JSON.stringify({
                                model,
                                messages,
                                temperature: 0.4,
                                max_tokens: 1024
                            })
                        }
                    );

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error?.message || `HTTP ${res.status}`);
                    }

                    const data = await res.json();
                    const rawReply = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
                    // Strip <think>...</think> reasoning blocks (MiniMax M2 series shows chain-of-thought)
                    const reply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

                    document.getElementById('ai-loading-bubble')?.remove();
                    addMessage('model', reply);
                    aiChatHistory.push({ role: 'model', text: reply });

                } catch (e) {
                    document.getElementById('ai-loading-bubble')?.remove();
                    const errMsg = e.message.includes('API_KEY_INVALID') || e.message.includes('400')
                        ? '❌ Invalid API key. Click the 🔑 key icon to update it.'
                        : `❌ Error: ${e.message}`;
                    addMessage('model', errMsg);
                } finally {
                    sendBtn.disabled = false;
                    inputEl.focus();
                }
            }

            // Expose masterData and exchangeRate to window for the AI context builder
            // (they are defined inside DOMContentLoaded but we reference them via window)
        })();
        }); // end DOMContentLoaded for AI module

