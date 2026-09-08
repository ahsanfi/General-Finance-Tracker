# Money Tracker

Personal finance web app with a Google Apps Script backend and Google Sheets database. Includes transactions, wallets/transfers, IDR/USD conversion, budgets, portfolio accounts, Tokocrypto synchronization, receipt scanning, AI-analysis exports, command search, and light/dark mobile layouts.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:3000/preview.html. This is an isolated sample preview: edits reset on reload and external integrations are blocked. Theme preferences persist. CDN assets require internet access.

## Deploy to Google Apps Script

1. Run `npm run build`.
2. Open your existing spreadsheet, then **Extensions > Apps Script**. Copy your separately maintained local `code.gs` into that existing project manually. Backend source is intentionally not included in this repository.
3. In the same Apps Script project, update the HTML file named **Index** with `deploy-step3/Index.html`. If needed, update the existing manifest using `deploy-step3/appsscript.json`.
4. Keep the existing spreadsheet and Script Properties. For first-time setup of the refactored backend, verify SPREADSHEET_ID, run `setup_` as the owner, and authorize the required scopes. Subsequent frontend updates do not require rerunning setup.
5. Choose **Deploy > Manage deployments > Edit > New version > Deploy** to update the existing web app deployment. The refactored backend expects execution as **User accessing the web app**; users need spreadsheet access and OAuth authorization as well as inclusion in the backend access list.
6. Reload the existing deployment URL. No new spreadsheet or repository-hosted backend is required.

GitHub stores the source. GitHub Pages cannot provide the native google.script.run connection; use Apps Script hosting for the live application.

## Backend and data compatibility

The separately maintained `code.gs` contains server authorization, validation, script locks, transfer compensation, portfolio-sale profit/loss booking, and server-side Tokocrypto signing. Income/Expenses A:F, Expenses G1 exchange rate, Portfolio A:G, System A:H, Investment A, Budget and legacy Budgets sheet layouts remain supported. All `.gs` files are ignored by Git; the build never copies or generates backend source.

Tokocrypto keys use Script Properties with fallback to old System G/H values. Saving Settings migrates them to properties and clears those sheet columns. Blank inputs preserve saved keys. Do not commit keys, authorization files or exported personal reports.

Sheets does not provide database transactions. Refresh and inspect records after interrupted writes or failed compensation before retrying. Some retained import controllers still need broader concurrency review.

## Groq receipt fix

The Groq model fix lives in `modules/groq-vision.js` and its callers in `app.js`, not code.gs. Receipt and Makmur image scans use Qwen 3.6 with Qwen 3.8 fallback on model-unavailable errors. Invalid keys, permissions and usage limits receive specific errors. No retired Llama 4 Scout ID is used in either scan path.

The saved key still needs model access and available quota. See [Groq vision models](https://console.groq.com/docs/vision) and [deprecations](https://console.groq.com/docs/deprecations). Other retained AI assistant integrations have separate model settings and need their own live verification.

## Monthly AI review

Choose **Export for AI review** on the dashboard or through More. Select a month and optional questions; download a Markdown report to attach to an AI conversation. It includes monthly cash flow, category spending, budgets, ledger balances, current portfolio allocation/P&L and app net worth. Historical investment valuations are unavailable and explicitly separated from current values. Notes are optional. No credentials or allowed-email list are exported, and nothing is automatically uploaded to an AI provider.

## Project files

- `index.html`, `app.js`, `style.css`, `shell.*`: active app and retained feature controllers.
- `modules/`: API/state, accounting, themes, forecasts, command/quick-add, mobile ergonomics, exports and Groq scanning.
- `appsscript.json`: manifest reference for the existing Apps Script project. Backend code is maintained outside this repository.
- `scripts/`: build and isolated preview server.
- `preview/`: sample data only.
- `tests/`: unit/regression checks; legacy feature IDs are a fixture rather than an entire old app copy.
- `deploy-step3/`: assembled deployment files, rebuilt by `npm run build`.

## Validation

```sh
npm run build
npm test
node tests/browser.cjs
```

Browser tests require Google Chrome and CDN access. GitHub Actions runs the frontend build and Node tests for accounting, model fallback, report contents and semantic palette contrast; browser checks cover core workflows and mobile gestures. Backend tests remain with the separately maintained local backend outside this repository.

Live Google permissions, real Sheets writes, provider access, scan accuracy and physical iOS/Android behavior were not verified with your account. Retained HTML-string renderers still need a broader security review, and all legacy image-export variants need further coverage. These files are prepared for review and deployment, not a claim of complete production certification.
