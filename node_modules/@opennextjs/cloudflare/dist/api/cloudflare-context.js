/**
 * Symbol used as an index in the global scope to set and retrieve the Cloudflare context
 *
 * This is used both in production (in the actual built worker) and in development (`next dev`)
 *
 * Note: this symbol needs to be kept in sync with the one used in `src/cli/templates/worker.ts`
 */
const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");
export function getCloudflareContext(options = { async: false }) {
    return options.async ? getCloudflareContextAsync() : getCloudflareContextSync();
}
/**
 * Get the cloudflare context from the current global scope
 */
function getCloudflareContextFromGlobalScope() {
    const global = globalThis;
    return global[cloudflareContextSymbol];
}
/**
 * Detects whether the current code is being evaluated in a statically generated route
 */
function inSSG() {
    const global = globalThis;
    // Note: Next.js sets globalThis.__NEXT_DATA__.nextExport to true for SSG routes
    // source: https://github.com/vercel/next.js/blob/4e394608423/packages/next/src/export/worker.ts#L55-L57)
    return global.__NEXT_DATA__?.nextExport === true;
}
/**
 * Utility to get the current Cloudflare context in sync mode
 */
function getCloudflareContextSync() {
    const cloudflareContext = getCloudflareContextFromGlobalScope();
    if (cloudflareContext) {
        return cloudflareContext;
    }
    // The sync mode of `getCloudflareContext`, relies on the context being set on the global state
    // by either the worker entrypoint (in prod) or by `initOpenNextCloudflareForDev` (in dev), neither
    // can work during SSG since for SSG Next.js creates (jest) workers that don't get access to the
    // normal global state so we throw with a helpful error message.
    if (inSSG()) {
        throw new Error(`\n\nERROR: \`getCloudflareContext\` has been called in sync mode in either a static route or at the top level of a non-static one,` +
            ` both cases are not allowed but can be solved by either:\n` +
            `  - make sure that the call is not at the top level and that the route is not static\n` +
            `  - call \`getCloudflareContext({async: true})\` to use the \`async\` mode\n` +
            `  - avoid calling \`getCloudflareContext\` in the route\n`);
    }
    throw new Error(initOpenNextCloudflareForDevErrorMsg);
}
/**
 * Utility to get the current Cloudflare context in async mode
 */
async function getCloudflareContextAsync() {
    const cloudflareContext = getCloudflareContextFromGlobalScope();
    if (cloudflareContext) {
        return cloudflareContext;
    }
    // Note: Next.js sets process.env.NEXT_RUNTIME to 'nodejs' when the runtime in use is the node.js one
    // We want to detect when the runtime is the node.js one so that during development (`next dev`) we know wether
    // we are or not in a node.js process and that access to wrangler's node.js apis
    const inNodejsRuntime = process.env.NEXT_RUNTIME === "nodejs";
    if (inNodejsRuntime || inSSG()) {
        // we're in a node.js process and also in "async mode" so we can use wrangler to asynchronously get the context
        const cloudflareContext = await getCloudflareContextFromWrangler();
        addCloudflareContextToNodejsGlobal(cloudflareContext);
        return cloudflareContext;
    }
    throw new Error(initOpenNextCloudflareForDevErrorMsg);
}
/**
 * Performs some initial setup to integrate as best as possible the local Next.js dev server (run via `next dev`)
 * with the open-next Cloudflare adapter
 *
 * Note: this function should only be called inside the Next.js config file, and although async it doesn't need to be `await`ed
 * @param options options on how the function should operate and if/where to persist the platform data
 */
export async function initOpenNextCloudflareForDev(options) {
    const shouldInitializationRun = shouldContextInitializationRun();
    if (!shouldInitializationRun)
        return;
    if (options?.environment && process.env.NEXT_DEV_WRANGLER_ENV) {
        console.warn(`'initOpenNextCloudflareForDev' has been called with an environment option while NEXT_DEV_WRANGLER_ENV is set.` +
            ` NEXT_DEV_WRANGLER_ENV will be ignored and the environment will be set to: '${options.environment}'`);
    }
    const context = await getCloudflareContextFromWrangler(options);
    addCloudflareContextToNodejsGlobal(context);
    await monkeyPatchVmModuleEdgeContext(context);
}
/**
 * Next dev server imports the config file twice (in two different processes, making it hard to track),
 * this causes the initialization to run twice as well, to keep things clean, not allocate extra
 * resources (i.e. instantiate two miniflare instances) and avoid extra potential logs, it would be best
 * to run the initialization only once, this function is used to try to make it so that it does, it returns
 * a flag which indicates if the initialization should run in the current process or not.
 *
 * @returns boolean indicating if the initialization should run
 */
function shouldContextInitializationRun() {
    // via debugging we've seen that AsyncLocalStorage is only set in one of the
    // two processes so we're using it as the differentiator between the two
    const AsyncLocalStorage = globalThis["AsyncLocalStorage"];
    return !!AsyncLocalStorage;
}
/**
 * Adds the cloudflare context to the global scope of the current node.js process, enabling
 * future calls to `getCloudflareContext` to retrieve and return such context
 *
 * @param cloudflareContext the cloudflare context to add to the node.sj global scope
 */
function addCloudflareContextToNodejsGlobal(cloudflareContext) {
    const global = globalThis;
    global[cloudflareContextSymbol] = cloudflareContext;
}
/**
 * Next.js uses the Node.js vm module's `runInContext()` function to evaluate edge functions
 * in a runtime context that tries to simulate as accurately as possible the actual production runtime
 * behavior, see: https://github.com/vercel/next.js/blob/9a1cd3/packages/next/src/server/web/sandbox/context.ts#L525-L527
 *
 * This function monkey-patches the Node.js `vm` module to override the `runInContext()` function so that the
 * cloudflare context is added to the runtime context's global scope before edge functions are evaluated
 *
 * @param cloudflareContext the cloudflare context to patch onto the "edge" runtime context global scope
 */
async function monkeyPatchVmModuleEdgeContext(cloudflareContext) {
    const require = (await import(/* webpackIgnore: true */ `${"__module".replaceAll("_", "")}`)).default.createRequire(import.meta.url);
    // eslint-disable-next-line unicorn/prefer-node-protocol -- the `next dev` compiler doesn't accept the node prefix
    const vmModule = require("vm");
    const originalRunInContext = vmModule.runInContext.bind(vmModule);
    vmModule.runInContext = (code, contextifiedObject, options) => {
        const runtimeContext = contextifiedObject;
        runtimeContext[cloudflareContextSymbol] ??= cloudflareContext;
        return originalRunInContext(code, contextifiedObject, options);
    };
}
/**
 * Gets a cloudflare context object from wrangler
 *
 * @returns the cloudflare context ready for use
 */
async function getCloudflareContextFromWrangler(options) {
    // Note: we never want wrangler to be bundled in the Next.js app, that's why the import below looks like it does
    const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${"__wrangler".replaceAll("_", "")}`);
    // This allows the selection of a wrangler environment while running in next dev mode
    const environment = options?.environment ?? process.env.NEXT_DEV_WRANGLER_ENV;
    const { env, cf, ctx } = await getPlatformProxy({
        ...options,
        environment,
    });
    return {
        env,
        cf: cf,
        ctx: ctx,
    };
}
// In production the cloudflare context is initialized by the worker so it is always available.
// During local development (`next dev`) it might be missing only if the developers hasn't called
// the `initOpenNextCloudflareForDev` function in their Next.js config file
const initOpenNextCloudflareForDevErrorMsg = `\n\nERROR: \`getCloudflareContext\` has been called without having called` +
    ` \`initOpenNextCloudflareForDev\` from the Next.js config file.\n` +
    `You should update your Next.js config file as shown below:\n\n` +
    "   ```\n   // next.config.mjs\n\n" +
    `   import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";\n\n` +
    `   initOpenNextCloudflareForDev();\n\n` +
    "   const nextConfig = { ... };\n" +
    "   export default nextConfig;\n" +
    "   ```\n" +
    "\n";
