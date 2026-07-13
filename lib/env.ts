import { z } from 'zod'

/**
 * Central, validated view of the environment. The app reads individual vars in
 * a few hot/edge paths (client.ts, cookie.ts) where a direct `process.env` read
 * with a fallback is deliberate; this module's job is to FAIL FAST at server
 * boot (via instrumentation.ts) when the deployment is misconfigured, instead of
 * silently falling back to a localhost default and surfacing a confusing error
 * on the first request.
 */

const boolStr = z.enum(['true', 'false'])

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // Public (browser-exposed) configuration.
    NEXT_PUBLIC_USE_MOCKS: boolStr.optional(),
    NEXT_PUBLIC_API_BASE_URL: z
      .string()
      .url('NEXT_PUBLIC_API_BASE_URL must be a valid URL.')
      .optional(),
    NEXT_PUBLIC_TENANT: z.string().min(1).optional(),
    NEXT_PUBLIC_IMAGE_HOSTNAMES: z.string().optional(),

    // Server-only configuration.
    BACKEND_INTERNAL_URL: z
      .string()
      .url('BACKEND_INTERNAL_URL must be a valid URL.')
      .optional(),
    SESSION_COOKIE_NAME: z.string().min(1).optional(),
    REFRESH_COOKIE_NAME: z.string().min(1).optional(),
    SESSION_COOKIE_SECURE: boolStr.optional(),
    MOCK_DELAY_MS: z
      .string()
      .regex(/^\d+$/, 'MOCK_DELAY_MS must be a non-negative integer (ms).')
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return
    const useMocks = env.NEXT_PUBLIC_USE_MOCKS === 'true'
    // A real backend is required in production unless the mock layer is on.
    if (
      !useMocks &&
      !env.BACKEND_INTERNAL_URL &&
      !env.NEXT_PUBLIC_API_BASE_URL
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BACKEND_INTERNAL_URL'],
        message:
          'In production without mocks, set BACKEND_INTERNAL_URL (or NEXT_PUBLIC_API_BASE_URL).',
      })
    }
    // Fail closed on the next/image allowlist. Leaving it unset in production
    // otherwise falls back to "any HTTPS host" (open image proxy → SSRF/abuse);
    // this is a hard boot failure so a deploy can never silently ship it open.
    if (!env.NEXT_PUBLIC_IMAGE_HOSTNAMES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_IMAGE_HOSTNAMES'],
        message:
          'In production, set NEXT_PUBLIC_IMAGE_HOSTNAMES to your CDN host(s) — an unset allowlist would open the next/image optimizer to any host.',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate an environment source. Throws an {@link Error} with a
 * human-readable summary of every problem (not a raw ZodError) so a failed boot
 * log points straight at the offending vars. Also warns — without failing — when
 * the next/image host allowlist is left open in production.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }
  // Non-fatal: the mock layer (incl. simulated auth) is a first-class feature,
  // so running it in production is allowed (demo builds) but worth flagging.
  if (
    result.data.NODE_ENV === 'production' &&
    result.data.NEXT_PUBLIC_USE_MOCKS === 'true'
  ) {
    console.warn(
      '[env] NEXT_PUBLIC_USE_MOCKS=true in production — the mock data layer, ' +
        'including simulated auth, is active. Ensure this is a demo deployment.',
    )
  }
  return result.data
}
