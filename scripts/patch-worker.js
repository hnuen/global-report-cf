const fs = require('fs');
let worker = fs.readFileSync('.open-next/worker.js', 'utf8');

// Remove durable-objects exports
worker = worker
  .replace(/export \{ DOQueueHandler \} from "\.\/\.build\/durable-objects\/queue\.js";\n?/g, '')
  .replace(/export \{ DOShardedTagCache \} from "\.\/\.build\/durable-objects\/sharded-tag-cache\.js";\n?/g, '')
  .replace(/export \{ BucketCachePurge \} from "\.\/\.build\/durable-objects\/bucket-cache-purge\.js";\n?/g, '');

// Fix import paths to point to parent directory (since worker will be in assets/)
worker = worker
  .replace(/from "\.\/cloudflare\//g, 'from "../cloudflare/')
  .replace(/from "\.\/middleware\//g, 'from "../middleware/')
  .replace(/import\("\.\/server-functions\//g, 'import("../server-functions/');

// Write _worker.js into assets folder
fs.writeFileSync('.open-next/assets/_worker.js', worker);
console.log('Worker written to .open-next/assets/_worker.js');
console.log('durable-objects refs:', (worker.match(/durable-objects/g)||[]).length);
