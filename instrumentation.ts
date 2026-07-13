/**
 * Next.js instrumentation hook — `register()` runs once when the server process
 * starts. We validate the environment here so a misconfigured deployment fails
 * fast at boot (with a clear message) instead of at the first request. Guarded
 * to the Node runtime: the edge runtime doesn't see the server-only vars.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env')
    validateEnv()
  }
}
