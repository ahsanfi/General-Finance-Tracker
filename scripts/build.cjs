const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const source = read('index.html');
const inline = source
  .replace(/<link rel="stylesheet" href="(?!https:)([^"]+)">/g, (_, file) => `<style>\n${read(file)}\n</style>`)
  .replace(/<script src="(?!https:)([^"?]+)(?:\?[^"]*)?"><\/script>/g, (_, file) => `<script>\n${read(file).replace(/<\/script/gi, '<\\/script')}\n</script>`);
const target = path.join(root, 'deploy-step3');
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, 'Index.html'), inline);
fs.writeFileSync(path.join(target, 'appsscript.json'), read('appsscript.json'));
fs.writeFileSync(path.join(root, 'preview.html'), source.replace('<head>', '<head>\n<script src="preview/fixtures.js"></script>'));
console.log('Built deploy-step3/Index.html, appsscript.json and the isolated local preview. Backend is managed separately in Apps Script.');
