const fs = require('fs');
const current = fs.readFileSync('src/index.ts', 'utf8');
const lines = current.split('\n');
const idx = lines.findIndex(e => e.indexOf('async function start') !== -1);
console.log('start() at line:', idx + 1);
for (let i = idx; i < lines.length; i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
