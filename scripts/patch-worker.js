const fs = require('fs');
const worker = fs.readFileSync('.open-next/worker.js', 'utf8');
const patched = worker
  .replace(/export \{ DOQueueHandler \} from "\.\/\.build\/durable-objects\/queue\.js";\n/, '')
  .replace(/export \{ DOShardedTagCache \} from "\.\/\.build\/durable-objects\/sharded-tag-cache\.js";\n/, '')
  .replace(/export \{ BucketCachePurge \} from "\.\/\.build\/durable-objects\/bucket-cache-purge\.js";\n/, '');
fs.writeFileSync('.open-next/_worker.js', patched);
console.log('Worker patched. durable-objects refs:', (patched.match(/durable-objects/g)||[]).length);
