const fs = require('fs');
let worker = fs.readFileSync('.open-next/worker.js', 'utf8');

// Remove missing durable-objects exports
worker = worker
  .replace(/export \{ DOQueueHandler \} from "\.\/\.build\/durable-objects\/queue\.js";\n?/g, '')
  .replace(/export \{ DOShardedTagCache \} from "\.\/\.build\/durable-objects\/sharded-tag-cache\.js";\n?/g, '')
  .replace(/export \{ BucketCachePurge \} from "\.\/\.build\/durable-objects\/bucket-cache-purge\.js";\n?/g, '');

// Write as _worker.js in .open-next root (same directory as cloudflare/, middleware/, server-functions/)
fs.writeFileSync('.open-next/_worker.js', worker);
console.log('_worker.js written to .open-next/');
console.log('durable-objects refs remaining:', (worker.match(/durable-objects/g)||[]).length);
