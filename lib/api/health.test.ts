// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'

const serverFetchAnonymous = vi.fn()

vi.mock('./client', () => ({
  USE_MOCKS: false,
  serverFetchAnonymous: (...args: unknown[]) => serverFetchAnonymous(...args),
}))

const { checkBackendHealth } = await import('./health')

beforeEach(() => {
  serverFetchAnonymous.mockReset()
})

describe('checkBackendHealth', () => {
  it('is up when GET /health answers, with a short uncached probe', async () => {
    serverFetchAnonymous.mockResolvedValue({ status: 'ok', uptime: 1 })
    await expect(checkBackendHealth()).resolves.toBe('up')
    expect(serverFetchAnonymous).toHaveBeenCalledWith(
      '/health',
      expect.objectContaining({ cache: 'no-store', timeoutMs: 3000 }),
    )
  })

  it('is down on a timeout (a sleeping instance) instead of throwing', async () => {
    serverFetchAnonymous.mockRejectedValue(
      new ApiError(0, null, 'Network failure: request timed out after 3000ms'),
    )
    await expect(checkBackendHealth()).resolves.toBe('down')
  })

  it('is down on a 5xx from the platform proxy', async () => {
    serverFetchAnonymous.mockRejectedValue(new ApiError(503, null, 'HTTP 503'))
    await expect(checkBackendHealth()).resolves.toBe('down')
  })
})
