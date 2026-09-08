const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function runtime(fetcher, url = 'https://script.google.com/macros/s/example/exec') {
  let cleared = 0;
  const context = vm.createContext({ console, FinTrackerConfig: { apiUrl: url },
    FinTracker: { auth: { credential: async () => 'test-credential', clear: () => cleared++ } }, fetch: fetcher });
  context.window = context;
  vm.runInContext(fs.readFileSync('modules/core.js', 'utf8'), context);
  return { api: context.FinTracker.api, store: context.FinTracker.store, cleared: () => cleared };
}
test('Pages transport sends authenticated simple POST and deduplicates concurrent reads', async () => {
  const calls = [];
  const e = runtime(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ status: 'success', income: [] }) }; });
  await Promise.all([e.api.request('getData'), e.api.request('getData')]);
  assert.equal(calls.length, 1);
  const { options } = calls[0];
  assert.equal(options.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'follow');
  assert.deepEqual(JSON.parse(options.body), { action: 'getData', credential: 'test-credential' });
  assert.equal(e.store.get().busy, 0);
});
test('Pages transport never retries a failed write and releases loading state', async () => {
  let calls = 0;
  const e = runtime(async () => { calls++; throw Error('network'); });
  await assert.rejects(e.api.request('add'), /Verify the result/);
  assert.equal(calls, 1); assert.equal(e.store.get().busy, 0);
});
test('Pages authentication failures clear credentials; HTML responses explain deployment settings', async () => {
  const e = runtime(async () => ({ ok: true, json: async () => ({ status: 'error', code: 'AUTH_REQUIRED', message: 'Sign in again' }) }));
  await assert.rejects(e.api.request('getData'), /Sign in again/);
  assert.equal(e.cleared(), 1);
  const html = runtime(async () => ({ ok: true, json: async () => { throw Error('HTML'); } }));
  await assert.rejects(html.api.request('getData'), /did not return JSON/);
});
test('Pages transport refuses to send credentials to an untrusted URL', async () => {
  let calls = 0;
  const e = runtime(async () => { calls++; }, 'https://example.com/exec');
  await assert.rejects(e.api.request('getData'), /deployment/);
  assert.equal(calls, 0);
});
