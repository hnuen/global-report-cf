const fs = require('fs');
// Simply rename worker.js to _worker.js — all referenced files exist in .open-next/
fs.copyFileSync('.open-next/worker.js', '.open-next/_worker.js');
// Copy assets to root so /_next/static/* is served correctly
const { execSync } = require('child_process');
execSync('cp -r .open-next/assets/. .open-next/');
console.log('Done: _worker.js created, assets copied to root');
