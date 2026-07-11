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

  it('warns (without failing) when image hosts are unset in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_USE_MOCKS: 'true',
    } as NodeJS.ProcessEnv)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_IMAGE_HOSTNAMES'),
    )
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
