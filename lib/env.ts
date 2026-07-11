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
    const useMocks = env.NEXT_PUBLIC_USE_MOCKS === 'true'
    // A real backend is required in production unless the mock layer is on.
    if (env.NODE_ENV === 'production' && !useMocks) {
      if (!env.BACKEND_INTERNAL_URL && !env.NEXT_PUBLIC_API_BASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BACKEND_INTERNAL_URL'],
          message:
            'In production without mocks, set BACKEND_INTERNAL_URL (or NEXT_PUBLIC_API_BASE_URL).',
        })
      }
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
  if (
    result.data.NODE_ENV === 'production' &&
    !result.data.NEXT_PUBLIC_IMAGE_HOSTNAMES
  ) {
    console.warn(
      '[env] NEXT_PUBLIC_IMAGE_HOSTNAMES is unset in production — next/image ' +
        'will accept any HTTPS host (open image proxy). Set it to your CDN host(s).',
    )
  }
  return result.data
}
