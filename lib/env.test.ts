import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateEnv } from './env'

const base = { NODE_ENV: 'development' } as NodeJS.ProcessEnv

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateEnv', () => {
  it('accepts a minimal development environment', () => {
    const env = validateEnv({ ...base })
    expect(env.NODE_ENV).toBe('development')
  })

  it('defaults NODE_ENV to development when absent', () => {
    expect(validateEnv({} as NodeJS.ProcessEnv).NODE_ENV).toBe('development')
  })

  it('rejects a non-URL backend URL', () => {
    expect(() =>
      validateEnv({ ...base, BACKEND_INTERNAL_URL: 'not-a-url' }),
    ).toThrow(/BACKEND_INTERNAL_URL must be a valid URL/)
  })

  it('rejects a non-numeric MOCK_DELAY_MS', () => {
    expect(() => validateEnv({ ...base, MOCK_DELAY_MS: 'soon' })).toThrow(
      /MOCK_DELAY_MS/,
    )
  })

  it('rejects an invalid boolean flag', () => {
    expect(() =>
      validateEnv({
        ...base,
        NEXT_PUBLIC_USE_MOCKS: 'yes',
      } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid environment configuration/)
  })

  it('requires a backend URL in production without mocks', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/In production without mocks/)
  })

  it('allows production with mocks enabled and no backend URL', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_USE_MOCKS: 'true',
      NEXT_PUBLIC_IMAGE_HOSTNAMES: 'cdn.example.com',
    } as NodeJS.ProcessEnv)
    expect(env.NEXT_PUBLIC_USE_MOCKS).toBe('true')
  })

  it('allows production with a real backend URL', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        BACKEND_INTERNAL_URL: 'https://api.nexio.com',
        NEXT_PUBLIC_IMAGE_HOSTNAMES: 'cdn.nexio.com',
      } as NodeJS.ProcessEnv),
    ).not.toThrow()
  })

  it('fails closed when image hosts are unset in production', () => {
    // Backend URL present so only the image-host rule can trip.
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        BACKEND_INTERNAL_URL: 'https://api.nexio.com',
      } as NodeJS.ProcessEnv),
    ).toThrow(/NEXT_PUBLIC_IMAGE_HOSTNAMES/)
  })

  it('warns (without failing) when mocks are enabled in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_USE_MOCKS: 'true',
      NEXT_PUBLIC_IMAGE_HOSTNAMES: 'cdn.nexio.com',
    } as NodeJS.ProcessEnv)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_USE_MOCKS'),
    )
  })

  it('accepts a valid workflow service URL', () => {
    const env = validateEnv({
      ...base,
      WORKFLOW_INTERNAL_URL: 'http://localhost:8080',
      WORKFLOW_FORWARD_JWT: 'false',
    } as NodeJS.ProcessEnv)
    expect(env.WORKFLOW_INTERNAL_URL).toBe('http://localhost:8080')
    expect(env.WORKFLOW_FORWARD_JWT).toBe('false')
  })

  it('rejects a non-URL workflow service URL', () => {
    // Note `localhost:8080` is NOT rejected — zod v3's `.url()` reads it as
    // scheme `localhost` with path `8080`, exactly as it does for
    // BACKEND_INTERNAL_URL above. A missing scheme is the case this catches.
    expect(() =>
      validateEnv({ ...base, WORKFLOW_INTERNAL_URL: 'not-a-url' }),
    ).toThrow(/WORKFLOW_INTERNAL_URL must be a valid URL/)
  })

  it('rejects a non-boolean WORKFLOW_FORWARD_JWT', () => {
    expect(() =>
      validateEnv({
        ...base,
        WORKFLOW_FORWARD_JWT: '1',
      } as NodeJS.ProcessEnv),
    ).toThrow(/WORKFLOW_FORWARD_JWT/)
  })

  it('boots in production with both workflow vars unset', () => {
    // The workflow engine is an optional subsystem: unset means "not
    // configured", never a failed boot. Guards this on purpose so the
    // deliberate omission from the production superRefine cannot regress.
    const env = validateEnv({
      NODE_ENV: 'production',
      BACKEND_INTERNAL_URL: 'https://api.nexio.com',
      NEXT_PUBLIC_IMAGE_HOSTNAMES: 'cdn.nexio.com',
    } as NodeJS.ProcessEnv)
    expect(env.WORKFLOW_INTERNAL_URL).toBeUndefined()
    expect(env.WORKFLOW_FORWARD_JWT).toBeUndefined()
  })

  it('aggregates multiple problems into one error message', () => {
    let message = ''
    try {
      validateEnv({
        ...base,
        BACKEND_INTERNAL_URL: 'bad',
        MOCK_DELAY_MS: 'x',
      })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('BACKEND_INTERNAL_URL')
    expect(message).toContain('MOCK_DELAY_MS')
  })
})
