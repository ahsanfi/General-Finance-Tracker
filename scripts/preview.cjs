const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = new Map([
  ['/', 'preview.html'], ['/index.html', 'index.html'], ['/config.js', 'config.js'], ['/modules/auth.js', 'modules/auth.js'],
  ['/style.css', 'style.css'], ['/app.js', 'app.js'],
  ['/preview.html', 'preview.html'], ['/preview/fixtures.js', 'preview/fixtures.js'], ['/shell.css', 'shell.css'], ['/shell.js', 'shell.js']
]);
for (const name of ['core.js', 'domain.js', 'dashboard.js', 'theme.js', 'assistant.js', 'ui.js', 'insights.js', 'workspace.js', 'mobile.js', 'mobile.css', 'ai-export.js', 'groq-vision.js', 'flagship.css', 'export.css']) {
  files.set('/modules/' + name, 'modules/' + name);
}
const server = http.createServer((request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file) { response.writeHead(404).end('Not found'); return; }
  const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html';
  fs.readFile(path.join(root, file), (error, data) => {
    if (error) { response.writeHead(500).end('Could not load preview file.'); return; }
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(data);
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(3000, '127.0.0.1', () => {
  console.log('Money Tracker preview: http://127.0.0.1:3000/preview.html');
  console.log('Sample data only; edits reset on reload. No live integrations. Press Ctrl+C to stop.');
});
