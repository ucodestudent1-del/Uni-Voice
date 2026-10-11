const { execSync } = require('child_process');
const diff = execSync('git diff --unified=0 src/index.ts').toString();
const lines = diff.split('\n');

// Find the line numbers where removed/added lines have brace imbalance
let hunkHeader = '';
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('@@')) {
    hunkHeader = l;
  } else if (l.startsWith('-') && !l.startsWith('--')) {
    let delta = 0;
    for (const c of l.substring(1)) { if (c === '{') delta++; if (c === '}') delta--; }
    if (Math.abs(delta) > 0) {
      console.log('HUNK: ' + hunkHeader);
      console.log('  REM delta=' + delta + ': ' + l.substring(0, 150));
    }
  }
}
