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

## Deploy: GitHub Pages frontend + Apps Script API + existing spreadsheet

1. Copy the contents of this folder into your existing Git repository, preserving its hidden `.git` directory. Commit and push the frontend files. Do not copy `code.gs` into the repository.
2. In repository **Settings > Pages**, select **Deploy from a branch**, your publishing branch, and **/ (root)**. The site starts at `index.html`; relative asset paths support a project URL such as `https://USERNAME.github.io/General-Finance-Tracker/`.
3. Check `config.js`: `apiUrl` must be your existing Apps Script `/exec` deployment URL, and `googleClientId` your Google OAuth **Web application** client ID. The values supplied are from the existing project; verify they still belong to your deployment. These two identifiers are public, not secrets.
4. In that OAuth client's **Authorized JavaScript origins**, add your Pages origin, for example `https://USERNAME.github.io` (no repository path). Add your custom domain origin if applicable. Keep the consent screen/test-user settings compatible with your permitted users.
5. Open your existing spreadsheet, **Extensions > Apps Script**. Manually replace `code.gs` using the separately supplied updated backend. Keep the same spreadsheet and credentials. Verify `SPREADSHEET_ID` and `OWNER_EMAIL` in Script Properties; run `setup_` once as the owner if these have not been initialized. Set `GOOGLE_CLIENT_ID` to exactly the same client ID as `config.js`.
6. Update the existing web app using **Deploy > Manage deployments > Edit > New version > Deploy**. For Pages, set **Execute as: Me** and **Who has access: Anyone**. Google sign-in tokens are checked by the backend on every POST, then checked against `OWNER_EMAIL` and the existing System allowed-email column. Requests without valid credentials are rejected, even though the HTTP endpoint is public. Your spreadsheet can remain private to the owner.
7. Open your **GitHub Pages URL**, sign in, and verify loading plus a transaction save. Frontend changes are published through GitHub; backend changes require copying `code.gs` and updating the existing Apps Script deployment. There is no need to copy `Index.html` into Apps Script for Pages hosting.

The API sends JSON in a `text/plain` POST to avoid a cross-origin preflight and follows Apps Script's ContentService redirect. It does not use `no-cors`, embed a shared secret, or trust a browser-supplied email. Native `google.script.run` remains available for optional Apps Script HTML hosting and the sample preview stays isolated.

Google ID tokens stay in memory and require sign-in again after reloading or expiry. The Apps Script-only verifier uses Google's `tokeninfo` endpoint and checks audience, issuer, expiry and verified email. This adds a Google network request per API call and can fail when that service is unavailable or throttled. Google recommends a JWT verification library for production-scale services; this implementation does not claim that scale. See [Google token verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

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

- `index.html`, `config.js`, `app.js`, `style.css`, `shell.*`: Pages entry, public connection settings, and app controllers.
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
