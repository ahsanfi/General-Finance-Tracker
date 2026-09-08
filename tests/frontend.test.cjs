const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = name => fs.readFileSync(name,'utf8');
test('all legacy feature hooks remain available after the component rewrite', () => {
  const original = JSON.parse(read('tests/fixtures/legacy-feature-ids.json'));
  const current = new Set([...read('index.html').matchAll(/\bid="([^"]*)"/g)].map(match=>match[1]));
  assert.deepEqual(original.filter(id=>!current.has(id)), []);
});
test('the controller uses the API module instead of the old live POST endpoint', () => {
  assert.ok(read('app.js').includes('FinTracker.api.request'));
  assert.ok(!/(?<!api\.)fetch\(WEB_APP_URL/.test(read('app.js').replace(/\s+/g,'')));
  assert.ok(read('modules/core.js').includes('.financeApi('));
});
test('Apps Script artifact is self-contained and excludes preview fixtures', () => {
  const html=read('deploy-step3/Index.html');
  assert.ok(!html.includes('preview/fixtures.js'));
  assert.ok(!/<script src="(?!https:)/.test(html));
  assert.ok(!/<link rel="stylesheet" href="(?!https:)/.test(html));
  assert.ok(!fs.existsSync('deploy-step3/code.gs'));
  assert.ok(!fs.existsSync('code.gs'));
});
