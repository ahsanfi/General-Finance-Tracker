# FinTracker

Personal finance tracker with a GitHub Pages frontend, Google Apps Script backend, and Google Sheets database.

This guide describes the current source as of September 14, 2026. Features become available on the live app after the relevant frontend files and Apps Script deployment are updated.

## Architecture and deployment

### Install on an iPhone (free)

1. Publish the updated contents of `money-tracker-github/`, including `manifest.webmanifest`, `sw.js`, `offline.html`, `icons/` and `modules/pwa.*`.
2. Open your GitHub Pages URL in Safari on the iPhone.
3. Tap **Share → Add to Home Screen**. Keep **Open as Web App** enabled if shown, then tap **Add**.
4. Open **FinTracker** from its Home Screen icon. You may need to sign in once in this app view; the existing session expiry rules still apply.

FinTracker opens in standalone mode, with its own icon and the existing phone layout. Installation instructions are also in **Settings & access**, reachable through **More** on mobile. No Mac or paid Apple membership is needed. See [Apple's installation instructions](https://support.apple.com/en-mide/guide/iphone/iphea86e5236/ios).

Internet is required for financial data and saves. After one successful online visit, an offline launch shows a reconnect screen. Only that generic screen is stored in the service-worker cache; financial responses are not cached or queued. A connection change does not reload the app or discard an open form. An interrupted save must be checked before retrying. Existing local session/settings storage is unchanged.

The service worker is scoped to this repository's URL and does not intercept Apps Script or AI requests. This is the website installed as a web app, not the separate Capacitor project. No Apps Script redeployment is required for this installation update. Native Safari/Home Screen sign-in and keyboard behavior still need a real-iPhone check.

The wallet icon is adapted from [Font Awesome Free 6.4.0](https://fontawesome.com/license/free), licensed CC BY 4.0.

```text
GitHub Pages app -> authenticated Apps Script API -> Google Sheets
Windows background job -> Tokocrypto API -> scoped Apps Script API -> Google Sheets
```

- Publish only the runtime files in `money-tracker-github/` to GitHub Pages.
- Keep `code.gs` outside GitHub. Copy it manually into the existing spreadsheet's Apps Script project.
- After backend changes, update the existing Web app deployment to a new version.
- The Web app executes as **Me**, with access set to **Anyone**. The application validates credentials itself.
- `config.js` contains the public Web app `/exec` URL and Google client ID. Keep the source and hosting copies consistent.
- No Apps Script HTML copy is needed for GitHub Pages hosting.
- This root README, tests, scripts, and local credentials stay outside the hosting folder.

See [GitHub Pages setup](GITHUB-PAGES-SETUP.md) for additional deployment instructions.

## Dashboard

### Financial Wellness Score

A custom 0–100 FinTracker indicator with a debt-free profile provided by the owner.
The dashboard shows four components and an expandable explanation of every formula:

| Component | Weight | Full-score reference |
| --- | --- | --- |
| Cash reserve | 35% | Available cash covers six months of average expenses. |
| Savings rate | 30% | Income minus expenses is at least 20% of income. |
| Cash-flow stability | 20% | Income covers expenses in every assessed month. |
| Budget adherence | 15% | No configured category exceeds its monthly budget. |

Uses up to three completed months, excluding an initial partial month of records.
Transfers, initial balances and investment-account activity are excluded from
income/spending metrics. Current cash includes initial balances and transfers,
excludes investment accounts and future transactions, and uses the current USD rate.
Monthly expenses such as insurance are included in average spending.

Unassessed components, including missing budgets or missing income, are omitted
and the remaining weights are rescaled. The UI shows assessment coverage, the
period, and an early-estimate label for fewer than three months. Missing records
can distort results; an empty month inside the history window counts as recorded
zero activity. Budgets only assess configured categories, with their share of
spending displayed. No extra API calls or new spreadsheet columns are needed.

The targets and weights are app design choices, not a standardized financial
well-being assessment or a credit score. The balance privacy toggle also hides
the wellness values. The calculation details explain these limitations.

For an isolated sample preview, run `node scripts/preview.cjs 8080` and open
`http://localhost:8080/`. This preview contains labeled sample history; edits reset
on reload and do not touch the spreadsheet. Preview scripts stay out of GitHub Pages.

### Account summaries

- Summary cards for balance, income, and expenses.
- Account balances and investment account distinction.
- Recent activity with transaction descriptions and amounts.
- Top Categories: the five largest spending categories, sorted by amount.
- Balance privacy toggle and persistent light/dark theme.

### Your month, ahead

| Figure | Meaning |
| --- | --- |
| Current cash | Recorded net balance in accounts not configured as investment accounts, through today. |
| Daily burn rate | This month's everyday expenses divided by elapsed calendar days, including days without spending. |
| Projected month-end cash | Current cash minus daily burn rate multiplied by days remaining this month. |
| Scenario month-end cash | The projection after applying a spending reduction and expected additional income. |

Calculation details:

- Daily burn excludes the `Transfer` and `Initial Balance` categories.
- Investment accounts and future-dated transactions are excluded from the outlook.
- Cash balances still include transfers into and out of cash accounts. Transfers between two cash accounts cancel out.
- USD amounts use the configured exchange rate and are shown in IDR.
- Current cash is available even without spending history. Forecasts show a history message when there are no eligible expenses.
- The spending reduction slider applies only to estimated remaining spending.
- Expected income entered in the scenario is hypothetical; it does not create a transaction.
- The figures depend on complete records and correct investment-account configuration. They are estimates, not scheduled financial actions.

### Spending charts

- **Where your money goes:** spending allocation by category, with IDR/USD selection.
- The default chart summarizes larger allocations and groups remaining categories as Other. Expand the breakdown to inspect all categories.
- Phones show a donut with readable category values below.
- **The Bigger Picture:** spending over time, total, daily average, peak spending, and comparison with a preceding period.
- Timeframes: Last 7 Days, Last 30 Days (default), 3 Months, 1 Year, and All Time.
- The Bigger Picture and category allocation charts share the same timeframe and currency filters.
- The trend includes zero-spending days and excludes transfers and future-dated entries.
- The category chart shows all recorded expenses; the trend uses the selected timeframe.

## Transactions, wallets, and transfers

- Add, edit, and delete income and expense records.
- Fields include description, date, category, account, currency, and amount.
- IDR and USD wallets/accounts.
- Transfer between accounts, including different currencies.
- Destination amount can use the configured conversion rate or an exact manually entered value.
- Arithmetic amount entry, including operations and parentheses.
- Quick Add supports income and expense; its transfer action opens the full editor.
- Receipt scanning from an uploaded or pasted image assists with transaction entry. Review extracted fields before saving.
- Reconcile recorded account balances against actual balances.
- Failed forms retain entered information; saving controls prevent duplicate submissions while a request is pending.

### Transaction history

- Search descriptions and filter by date, category, and wallet/account.
- Date presets include this month, last month, 30 days, and this year.
- Desktop renders the latest 30 transactions when no filter is active; filtered history shows matching records.
- This is a rendering limit, not backend pagination. Analytics still use the loaded ledger.
- Mobile transaction swipes open edit or deletion confirmation. Buttons remain available.

## Calendar and summaries

- Daily, calendar, and monthly views.
- Month navigation and individual day selection.
- Current-date and selected-date indicators.
- Income/expense dots on calendar days.
- Day details with descriptions, category/account context, and signed amounts.

## Budgets

- Monthly budgets by expense category.
- Budget total, spending, remaining amount, and progress.
- Category-level overspending indicators.
- Unbudgeted spending section.
- Set, update, and remove category budgets.
- Copy a budget from another month.

## Investments

- Track holdings by platform, currency, invested amount, current value, and units.
- Add, edit, and remove assets.
- Buy/sell workflows and realized profit/loss recording.
- Portfolio value and profit/loss summaries.
- Allocation visualization, holding weights, and expandable breakdown.
- Compact mobile chart labels with readable values below.
- Unallocated broker cash and investment account management.

### Platform synchronization

| Platform | Available sync |
| --- | --- |
| Tokocrypto | Account balances through Apps Script, local browser-assisted sync, or the fully background Windows job. |
| Pluang / Pluang USD | Refresh prices for recorded holdings using market tickers and unit balances. This does not import a Pluang account. |
| Makmur | Extract holdings from a screenshot using the selected AI provider. |
| Bibit and Pintu | Manual tracking; no automatic account-sync integration is currently implemented. |

Tokocrypto missing-price warnings preserve previous valuations. The local/background importer skips invalid balance rows and identifies them in the result; if every returned row is invalid, it stops without saving. Partial success can include warnings.

Cloud Tokocrypto requests can encounter HTTP 451. Local execution uses the computer's connection, but is not guaranteed to avoid provider restrictions.

### Latest sync in Google Sheets

`Investment` column A identifies the platform. Column B, **Latest Sync**, stores the latest successful save from a sync:

- Tokocrypto cloud, local, and background saves.
- Makmur screenshot sync.
- Pluang price sync, matching the `Pluang USD` account name.
- Values are real Sheets dates formatted as `yyyy-mm-dd hh:mm:ss`, using the spreadsheet's time zone.
- Failed syncs keep the earlier timestamp.
- A partial sync that saves valid data can update the timestamp; consult its warnings for skipped data.
- Ordinary manual asset edits do not claim a new sync.
- Account reordering in Settings preserves timestamps by account name.
- Historical sync dates are not backfilled.

## Fully background Tokocrypto sync on Windows

The background job runs once after Windows sign-in, without a browser, console window, pairing dialog, or Google login. It reads Tokocrypto locally, saves through a restricted Apps Script endpoint, logs the result, and exits. It is not a continuous polling service.

### One-time setup

1. Install Node.js 20 or newer.
2. Run `Start_Toko_Sync.bat` once to save the Tokocrypto API key and secret.
3. Run `Setup_Toko_Background.bat`.
4. Follow `local-sync/.private/apps-script-setup.txt`: copy the latest root `code.gs`, set `TOKO_BACKGROUND_TOKEN_SHA256` in Script Properties, and update the existing Web app deployment.
5. Run `Enable_Toko_Startup.bat` if the startup shortcut is not already installed.
6. Double-click `Silent_Toko_Sync.vbs` to test without restarting.

The installed startup shortcut waits 45 seconds after Windows sign-in. Keep the workspace at its current location, or reinstall the shortcut after moving it.

| File | Purpose |
| --- | --- |
| `Silent_Toko_Sync.vbs` | Run the fully background job immediately. |
| `Enable_Toko_Startup.bat` | Install the current user's startup shortcut. |
| `Disable_Toko_Startup.bat` | Remove that shortcut; does not cancel an already-running job. |
| `Setup_Toko_Background.bat` | Prepare the encrypted background credential and setup instructions. |
| `Start_Toko_Sync.bat` | Browser-assisted alternative, with a visible helper console. |
| `local-sync/.private/startup.log` | Background execution result, including warnings or failure details. |
| `local-sync/.private/startup-error.log` | Launcher failure or last-run status. |

Windows encrypts local credentials for the Windows account that created them. Copying encrypted files to another account or computer does not transfer access. Do not publish the `.private` directory.

The background credential can read Tokocrypto holdings and update balances/valuations, including adding holdings with zero invested cost. It cannot access the transaction ledger, change invested amounts, delete holdings, or modify other platforms. Delete `TOKO_BACKGROUND_TOKEN_SHA256` from Script Properties to revoke it.

See [local sync instructions](local-sync/README.md) for the browser-assisted and manual terminal alternatives.

## AI tools

- AI finance assistant using the configured provider.
- Receipt extraction to reduce transaction typing.
- Makmur screenshot extraction for investment updates.
- Provider settings for Groq and Google AI Studio.
- Provider errors and unavailable-model handling.
- Provider credentials for AI features are stored in the browser; keys and enabled models must have access and available quota.
- AI results should be reviewed. Configuring a key does not guarantee model or service availability.
- Selecting a scan or submitting an assistant request can send the relevant image or financial context to the selected provider.

## Exports

| Export | Contents |
| --- | --- |
| CSV | Loaded transaction ledger: type, date, description, category, account, currency, and amount. Not restricted to the visible 30 rows. |
| PNG snapshot | A visual finance snapshot. |
| Monthly AI review | Markdown report for a selected month, including financial summaries, budgets, and current portfolio context. |

The monthly AI review accepts optional goals/questions and optionally includes transaction descriptions. It excludes credentials and access emails, but contains financial data and account names. Current portfolio values are distinguished from the selected month's activity; they are not a historical portfolio snapshot. Downloading the report does not automatically send it to an AI service.

## Navigation and mobile behavior

- Desktop navigation and mobile Home, History, Add, Plan, and More tabs.
- AI Assistant button integrated into the top header on mobile to maximize screen real estate, remaining as a floating button on desktop.
- Polished pull-to-refresh interactions and optimized layout padding on mobile devices.
- Cmd+K / Ctrl+K command palette for navigation, quick actions, and transaction search.
- Keyboard navigation in the command palette.
- Mobile bottom sheets, swipe-to-dismiss support, safe-area spacing, and keyboard-aware positioning.
- Dedicated amount calculator and visible edit/delete alternatives to gestures.
- Loading, success, and error feedback.
- Reduced-motion handling and light/dark styling.

## Settings and access

- Configure expense/income categories, IDR/USD accounts, and investment accounts.
- Manage allowed Google accounts.
- Google sign-in exchanges a verified credential for a 30-day browser session.
- Refreshing the page retains an unexpired session in the same browser profile when browser storage remains available.
- Sign-out/lock revokes the session. The backend checks expiry and the current access list on requests.
- Tokocrypto keys saved through app Settings use Apps Script Properties, with legacy sheet-key migration support.
- Local background credentials are separate from browser sessions and cloud Tokocrypto keys.

## Local development and checks

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd test
node tests/browser.cjs
```

- Preview fixtures are isolated from live accounts.
- A local proxy server (`node proxy.js`) runs at `localhost:8080` during development to bypass browser CORS restrictions and proxy API requests reliably to Google Apps Script.
- The client automatically retries interrupted API requests to mitigate intermittent connection drops, especially on mobile networks or strict tracking-prevention browsers.
- `npm.cmd run build` generates the preview and `deploy-step3/` artifacts. It does not automatically copy every change into `money-tracker-github/`.
- Keep changed hosting files synchronized before publishing.
- Browser checks require Chrome and access to frontend CDN dependencies.
- Automated tests use mocked Google/provider services where appropriate; a passing test run is not proof that a live deployment or provider is currently available.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Old interface or instructions | Publish the changed runtime files, then reload the page. |
| No background sync result | Read `startup.log` and `startup-error.log`; confirm the startup shortcut and saved credentials. |
| Apps Script HTTP 404 or HTML instead of JSON | Confirm the active `/exec` URL, current deployment version, Execute as Me, and Anyone access. |
| Background credential rejected | Confirm the generated verification hash is saved in the correct Apps Script project. |
| Pairing token rejected in browser-assisted sync | Restart the BAT and use the page it opens; tokens change when the helper restarts. |
| Tokocrypto HTTP 451 | Provider access restriction; inspect local results or contact the provider. |
| Some balances or prices skipped | Review the warning list. Existing affected values are retained. |
| Latest Sync remains blank | Deploy the timestamp update, run a successful supported sync, and check the matching Investment row. |
| Outlook cash is unexpected | Check investment-account configuration, recorded opening balances, transfers, dates, and exchange rate. |

Google Sheets does not provide full database transaction guarantees. The backend uses locks, validation, conflict checks, and compensating writes where implemented. After an interrupted write, inspect the saved state before retrying.

