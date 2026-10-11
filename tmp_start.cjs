const { execSync } = require('child_process');
const original = execSync('git show HEAD:src/index.ts').toString();
const lines = original.split('\n');
const idx = lines.findIndex(e => e.indexOf('async function start') !== -1);
console.log('Start function at line:', idx + 1);
for (let i = idx; i < Math.min(lines.length, idx + 55); i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
