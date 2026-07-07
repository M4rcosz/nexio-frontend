import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A per-test cookie store backing the mocked next/headers. `set` is a spy so we
// can assert the rotated pair is persisted after a successful refresh.
const cookieStore = new Map<string, string>()
const setSpy = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
    set: (...args: unknown[]) => setSpy(...args),
  }),
}))

import { serverFetch } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  cookieStore.clear()
  setSpy.mockClear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serverFetch 401 retry', () => {
  it('refreshes on 401, persists the rotated pair, and replays once', async () => {
    cookieStore.set('nexio_session', 'expired.jwt.token')
    cookieStore.set('nexio_refresh', 'rt-1')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'new.jwt', refresh_token: 'rt-2' }),
      ) // refresh
      .mockResolvedValueOnce(jsonResponse(200, { id: 'ok' })) // retry

    const data = await serverFetch<{ id: string }>('/me/orders')

    expect(data).toEqual({ id: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // Rotated pair written back via cookies().set.
    expect(setSpy).toHaveBeenCalledWith(
      'nexio_session',
      'new.jwt',
      expect.anything(),
    )
    expect(setSpy).toHaveBeenCalledWith(
      'nexio_refresh',
      'rt-2',
      expect.anything(),
    )
    // The replayed request carried the new bearer token.
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit
    expect((retryInit.headers as Headers).get('authorization')).toBe(
      'Bearer new.jwt',
    )
  })

  it('propagates the original 401 when the refresh itself fails', async () => {
    cookieStore.set('nexio_session', 'expired.jwt.token')
    cookieStore.set('nexio_refresh', 'rt-1')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'refresh invalid' }))

    await expect(serverFetch('/me/orders')).rejects.toMatchObject({
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('propagates 401 without refreshing when no refresh cookie exists', async () => {
    cookieStore.set('nexio_session', 'expired.jwt.token')
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))

    await expect(serverFetch('/me/orders')).rejects.toMatchObject({
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries at most once — a 401 on the replay is not re-refreshed', async () => {
    cookieStore.set('nexio_session', 'expired.jwt.token')
    cookieStore.set('nexio_refresh', 'rt-1')
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' })) // original
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: 'new.jwt', refresh_token: 'rt-2' }),
      ) // refresh
      .mockResolvedValueOnce(jsonResponse(401, { message: 'still expired' })) // retry

    await expect(serverFetch('/me/orders')).rejects.toMatchObject({
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
