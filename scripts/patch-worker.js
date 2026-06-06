const fs = require('fs');
let worker = fs.readFileSync('.open-next/worker.js', 'utf8');

// Remove missing durable-objects exports
worker = worker
  .replace(/export \{ DOQueueHandler \} from "\.\/\.build\/durable-objects\/queue\.js";\n?/g, '')
  .replace(/export \{ DOShardedTagCache \} from "\.\/\.build\/durable-objects\/sharded-tag-cache\.js";\n?/g, '')
  .replace(/export \{ BucketCachePurge \} from "\.\/\.build\/durable-objects\/bucket-cache-purge\.js";\n?/g, '');

// Add static file passthrough via ASSETS binding
// Insert after "const url = new URL(request.url);"
worker = worker.replace(
  'const url = new URL(request.url);\n',
  `const url = new URL(request.url);
            // Serve static Next.js assets directly from ASSETS binding
            if (url.pathname.startsWith('/_next/static/') || url.pathname === '/favicon.ico') {
                return env.ASSETS.fetch(request);
            }
`
);

fs.writeFileSync('.open-next/_worker.js', worker);
console.log('Worker patched with static passthrough');
console.log('durable-objects refs:', (worker.match(/durable-objects/g)||[]).length);
