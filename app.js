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
                if (urlParams.has('amount') || urlParams.has('desc')) {
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

            // --- Daily / Calendar Sub-tab logic ---
            function setDailySubTab(tab) {
                const isDaily = tab === 'daily';
                document.getElementById('subtab-daily-content').classList.toggle('hidden', !isDaily);
                document.getElementById('subtab-calendar-content').classList.toggle('hidden', isDaily);

                const dailyBtn = document.getElementById('subtab-daily-btn');
                const calBtn = document.getElementById('subtab-calendar-btn');

                if (isDaily) {
                    dailyBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-theme-primary/20 text-theme-primaryLight border border-theme-primary/30 transition';
                    calBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-300 transition';
                } else {
                    calBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl bg-theme-primary/20 text-theme-primaryLight border border-theme-primary/30 transition';
                    dailyBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-500 hover:text-slate-300 transition';
                    renderCalendar(masterData); // Refresh calendar when switching to it
                }
            }

            document.getElementById('subtab-daily-btn').addEventListener('click', () => setDailySubTab('daily'));
            document.getElementById('subtab-calendar-btn').addEventListener('click', () => setDailySubTab('calendar'));

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

                document.getElementById('account-balances-container').innerHTML = Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).map((b, idx) => {
                    const isUSD = b.c === 'USD';
                    const id = `bal-${idx}`;
                    return `
                    <div class="bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition flex flex-col justify-center min-h-[80px] relative group shadow-inner">
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest truncate mb-1" title="${b.n}">${b.n}</span>
                        <span id="${id}" class="font-bold font-mono text-sm tracking-tighter truncate ${b.v >= 0 ? 'text-theme-primaryLight' : 'text-rose-400'} ${isUSD ? 'cursor-pointer' : ''}" onclick="${isUSD ? `toggleCurrency('${id}', ${b.v})` : ''}">
                            ${fmt(b.v, b.c)}
                        </span>
                        ${isUSD ? '<div class="absolute top-2 right-2 text-[8px] bg-white/5 p-1 rounded text-slate-500 group-hover:text-theme-primaryLight transition"><i class="fas fa-exchange-alt"></i></div>' : ''}
                    </div>
                `;
                }).join('');

                const totalIncReal = incIDR + (incUSD * exchangeRate);
                const totalExpReal = expIDR + (expUSD * exchangeRate);
                const netCashFlowIDR = totalIncReal - totalExpReal;
                let totalAssetIDR = 0; Object.values(bals).forEach(b => { if (b.c === 'IDR') totalAssetIDR += b.v; if (b.c === 'USD') totalAssetIDR += (b.v * exchangeRate); });

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

                renderDaily(masterData); renderCalendar(masterData); updateChart(masterData); updateTrendChart(masterData); renderDashWidgets(masterData);
            }

            window.toggleCurrency = (id, usdVal) => {
                const el = document.getElementById(id);
                if (el.textContent.includes('$')) { const idrVal = usdVal * exchangeRate; el.textContent = fmt(idrVal, 'IDR'); el.classList.add('text-yellow-400'); } else { el.textContent = fmt(usdVal, 'USD'); el.classList.remove('text-yellow-400'); }
            };

            function renderDaily(data) {
                const dly = {}; data.filter(d => d.type === 'expense' && d.cat !== 'Transfer').forEach(d => { if (!dly[d.date]) dly[d.date] = { idr: 0, usd: 0 }; if (d.curr === 'IDR') dly[d.date].idr += d.amt; else dly[d.date].usd += d.amt; });
                document.getElementById('daily-body').innerHTML = Object.keys(dly).sort().reverse().map(dt => `<tr class="hover:bg-white/5 transition border-b border-white/5 last:border-0"><td class="px-6 py-4 text-sm text-slate-300 font-medium font-mono">${dt}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].idr > 0 ? fmt(dly[dt].idr, 'IDR') : '-'}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].usd > 0 ? fmt(dly[dt].usd, 'USD') : '-'}</td></tr>`).join('');
            }

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

            document.getElementById('add-entry-form').addEventListener('submit', e => {
                e.preventDefault(); const btn = document.getElementById('submit-btn'); const origTxt = btn.innerHTML; btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent"></div>'; btn.disabled = true;
                const type = document.querySelector('input[name="entry-type"]:checked').value, date = document.getElementById('entry-date').value, desc = document.getElementById('entry-desc').value;
                let payload = {};

                if (isEditing) {
                    let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                    payload = {
                        action: 'edit',
                        oldSheetName: editItem.type === 'income' ? 'Income' : 'Expenses',
                        originalData: editItem,
                        newSheetName: type === 'income' ? 'Income' : 'Expenses',
                        newData: { date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: Math.abs(parseFloat(document.getElementById('entry-amt-source').value)) }
                    };
                } else {
                    if (type === 'transfer') {
                        const fromAmt = parseFloat(document.getElementById('entry-amt-source').value), toAmtInput = document.getElementById('entry-amt-target').value, toAmt = toAmtInput ? parseFloat(toAmtInput) : fromAmt;
                        if (document.getElementById('entry-acc-source').value === document.getElementById('entry-acc-target').value && document.getElementById('entry-curr-source').value === document.getElementById('entry-curr-target').value) { showToast("Source and Target are identical!", 'error'); btn.innerHTML = origTxt; btn.disabled = false; return; }
                        payload = { action: 'transfer', date, description: desc, fromAccount: document.getElementById('entry-acc-source').value, fromCurrency: document.getElementById('entry-curr-source').value, fromAmount: Math.abs(fromAmt), toAccount: document.getElementById('entry-acc-target').value, toCurrency: document.getElementById('entry-curr-target').value, toAmount: Math.abs(toAmt) };
                    } else {
                        let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                        payload = { action: 'add', sheetName: type === 'income' ? 'Income' : 'Expenses', date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: Math.abs(parseFloat(document.getElementById('entry-amt-source').value)) };
                    }
                }

                fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json()).then(d => {
                    if (d.status === 'success') { showToast(d.message, 'success'); resetForm(); setTimeout(fetchData, 1500); } else throw new Error(d.message);
                }).catch(e => showToast("Error: " + e.message, 'error')).finally(() => { btn.innerHTML = origTxt; btn.disabled = false; });
            });

            function resetForm() {
                document.getElementById('add-entry-form').reset(); document.getElementById('entry-date').valueAsDate = new Date();
                isEditing = false; editItem = null; document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primaryLight border border-theme-primary/30"><i class="fas fa-plus"></i></div> New Entry'; document.getElementById('cancel-edit-btn').classList.add('hidden');
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
            document.getElementById('config-btn').addEventListener('click', () => {
                document.getElementById('groq-api-key').value = localStorage.getItem('groqApiKey') || '';
            });

            const scanBtn = document.getElementById('scan-receipt-btn');
            const uploadInput = document.getElementById('receipt-upload');
            scanBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!localStorage.getItem('groqApiKey')) {
                    showToast("Please save your Groq API Key in Config first", "error");
                    switchTab('view-config');
                    return;
                }
                uploadInput.click();
            });

            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
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

                    const apiKey = localStorage.getItem('groqApiKey');
                    const prompt = `You are a receipt data extractor. Analyze this receipt and extract:
1. Total Amount (number only, no currency symbols)
2. Description (store name or short summary)
3. Date (YYYY-MM-DD format, if not visible return current date)
4. Category (choose the most appropriate one: Food, Shopping, Transport, Utilities, Health, Entertainment, Error, Transfer, Charity, Salary, Interest, Deposit)
Return ONLY a valid JSON object matching this exact structure:
{"amount": 100000, "description": "Store Name", "date": "2024-05-05", "category": "Food"}
Do not wrap in markdown tags like \`\`\`json.`;

                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: "meta-llama/llama-4-scout-17b-16e-instruct",
                            messages: [{
                                role: "user",
                                content: [
                                    { type: "text", text: prompt },
                                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Img}` } }
                                ]
                            }],
                            temperature: 0.1,
                            max_tokens: 1024
                        })
                    });

                    if (res.status === 429) throw new Error("Groq Rate Limit Exceeded. Please try again shortly.");
                    if (!res.ok) {
                        const errData = await res.json().catch(() => null);
                        const errMsg = errData && errData.error ? errData.error.message : await res.text();
                        throw new Error(`Groq API Error: ${res.status} - ${errMsg}`);
                    }
                    const data = await res.json();
                    let text = data.choices[0].message.content.trim();

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
                    showToast("Receipt scanned successfully!", "success");
                } catch (err) {
                    console.error(err);
                    showToast("Failed to scan receipt: " + err.message, "error");
                } finally {
                    scanBtn.innerHTML = origHtml;
                    scanBtn.disabled = false;
                    uploadInput.value = '';
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

            function renderConfigUI() {
                const container = document.getElementById('config-sections-container');
                const sections = [
                    { title: "Expense Categories", key: "exp", color: "rose", icon: "fa-tags" },
                    { title: "Income Categories", key: "inc", color: "emerald", icon: "fa-tags" },
                    { title: "IDR Wallets", key: "walletsIDR", color: "blue", icon: "fa-wallet" },
                    { title: "USD Wallets", key: "walletsUSD", color: "teal", icon: "fa-dollar-sign" }
                ];

                let html = '';
                sections.forEach(s => {
                    const list = SYSTEM_CONFIG[s.key] || [];
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
                                <input type="text" id="config-new-${s.key}" class="flex-grow input-glow bg-black/40 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600" placeholder="New item...">
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

                btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent mx-auto"></div>';
                btn.disabled = true;

                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'updateSystemConfig', config: SYSTEM_CONFIG })
                }).then(r => r.json()).then(d => {
                    if (d.status === 'success') {
                        showToast("Configuration Saved!", 'success');
                        // Update dropdowns immediately just in case
                        updateWalletOptions(document.getElementById('entry-curr-source').value, 'entry-acc-source');
                        updateWalletOptions(document.getElementById('entry-curr-target').value, 'entry-acc-target');
                        updateCategoryOptions(document.querySelector('input[name="entry-type"]:checked').value);
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
            const GROQ_KEY_STORAGE = 'mtracker_groq_key';
            let aiChatHistory = []; // { role: 'user'|'model', text: string }

            const panel     = document.getElementById('ai-panel');
            const backdrop  = document.getElementById('ai-backdrop');
            const messagesEl = document.getElementById('ai-messages');
            const inputEl   = document.getElementById('ai-input');
            const sendBtn   = document.getElementById('ai-send-btn');
            const keySetup  = document.getElementById('ai-key-setup');
            const suggestEl = document.getElementById('ai-suggestions');

            function getKey() { return localStorage.getItem(GROQ_KEY_STORAGE) || ''; }

            function openPanel() {
                panel.classList.remove('translate-x-full');
                backdrop.classList.remove('hidden');
                document.getElementById('ai-chat-btn').classList.add('scale-0', 'opacity-0', 'pointer-events-none'); // hide FAB
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
                document.getElementById('ai-chat-btn').classList.remove('scale-0', 'opacity-0', 'pointer-events-none'); // restore FAB
            }

            document.getElementById('ai-chat-btn').addEventListener('click', openPanel);
            document.getElementById('ai-close-btn').addEventListener('click', closePanel);
            backdrop.addEventListener('click', closePanel);

            // API Key save
            document.getElementById('ai-key-save-btn').addEventListener('click', () => {
                const key = document.getElementById('ai-key-input').value.trim();
                if (!key) { return; }
                localStorage.setItem(GROQ_KEY_STORAGE, key);
                keySetup.style.display = 'none';
                keySetup.classList.add('hidden');
                messagesEl.classList.remove('hidden');
                suggestEl.classList.remove('hidden');
                addMessage('model', "Hi! I'm your AI Finance Assistant 👋 I have full access to your transaction data. Ask me anything about your spending, income, trends, or budgets!");
            });

            // Settings (re-show key setup)
            document.getElementById('ai-settings-btn').addEventListener('click', () => {
                document.getElementById('ai-key-input').value = getKey();
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

                // --- Recent transactions: last 3 months (raw, for detailed queries) ---
                const cutoff3m = new Date(today);
                cutoff3m.setMonth(cutoff3m.getMonth() - 3);
                const cutoff3mStr = cutoff3m.toISOString().split('T')[0];

                const recentTx = data
                    .filter(d => d.date >= cutoff3mStr)
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(d => `${d.date}|${d.type}|${d.desc}|${d.cat}|${d.curr}|${d.amt}`)
                    .join('\n') || '(none)';

                // --- Monthly summary: all time, aggregated by month+category ---
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

                return `You are a personal finance assistant for MTracker app.
Today's date: ${todayStr}
Exchange rate: 1 USD = ${window.exchangeRate || 16000} IDR
Currency: Primary is IDR (Indonesian Rupiah).

== RECENT TRANSACTIONS (last 3 months) ==
Format: date|type|description|category|currency|amount
${recentTx}

== MONTHLY SUMMARY (all time, aggregated) ==
Format: month|type|category|currency|total_amount
${summaryLines}

Instructions:
- For specific transaction lookups (e.g. "coffee last week"), use RECENT TRANSACTIONS.
- For trend/history questions, use MONTHLY SUMMARY.
- Format IDR amounts with commas, e.g. IDR 1,234,567.
- "Last week" = Mon-Sun of the previous calendar week.
- Be concise and friendly. Say honestly if data is unavailable.`;
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
                    // Groq OpenAI-compatible format
                    const messages = [
                        { role: 'system', content: systemCtx },
                        ...aiChatHistory.map(m => ({
                            role: m.role === 'model' ? 'assistant' : m.role,
                            content: m.text
                        }))
                    ];

                    const res = await fetch(
                        'https://api.groq.com/openai/v1/chat/completions',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${getKey()}`
                            },
                            body: JSON.stringify({
                                model: 'llama-3.3-70b-versatile',
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
                    const reply = data.choices?.[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

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

