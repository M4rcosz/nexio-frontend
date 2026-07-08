import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'

// Capture the request handed to the next-intl middleware so we can assert what
// the downstream RSC render will actually see (next-intl forwards these request
// headers to the render). A blind pass-through wouldn't prove the C4 fix.
const captor = vi.hoisted(() => ({ req: null as unknown }))
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server')
  return {
    default: () => (req: unknown) => {
      captor.req = req
      return NextResponse.next()
    },
  }
})

vi.mock('@/lib/api/auth', () => ({ refreshBackend: vi.fn() }))

import { refreshBackend } from '@/lib/api/auth'
import middleware from './middleware'

const mockedRefresh = vi.mocked(refreshBackend)

/** JWT-shaped token whose payload carries the given claims. */
function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${body}.signature`
}

const validToken = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 })
const expiredToken = makeToken({ exp: Math.floor(Date.now() / 1000) - 60 })

function makeReq(
  pathname: string,
  cookies: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest(`http://localhost${pathname}`, {
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...extraHeaders,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  captor.req = null
})

describe('middleware refresh + guard', () => {
  it('renews an expired session and re-emits the rotated cookies', async () => {
    mockedRefresh.mockResolvedValue({
      access_token: 'new.access',
      refresh_token: 'new.refresh',
    })

    const res = await middleware(
      makeReq('/cart', { nexio_session: expiredToken, nexio_refresh: 'rt-1' }),
    )

    expect(mockedRefresh).toHaveBeenCalledWith('rt-1')
    expect(res.cookies.get('nexio_session')?.value).toBe('new.access')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('new.refresh')
    // Passed the guard rather than redirecting.
    expect(res.headers.get('location')).toBeNull()

    // C4: the request forwarded to the RSC render must already carry the rotated
    // token — both the cookie jar and the raw `cookie` header next-intl forwards.
    const forwarded = captor.req as NextRequest
    expect(forwarded.cookies.get('nexio_session')?.value).toBe('new.access')
    expect(forwarded.headers.get('cookie')).toContain(
      'nexio_session=new.access',
    )
  })

  it('skips renewal on a prefetch request (never rotates speculatively)', async () => {
    const res = await middleware(
      makeReq(
        '/cart',
        { nexio_session: expiredToken, nexio_refresh: 'rt-1' },
        { 'next-router-prefetch': '1' },
      ),
    )

    // C2: prefetch must not consume/rotate the refresh token nor clear cookies.
    expect(mockedRefresh).not.toHaveBeenCalled()
    expect(res.cookies.get('nexio_session')?.value).toBeUndefined()
    expect(res.cookies.get('nexio_refresh')?.value).toBeUndefined()
  })

  it('keeps the session on a transient (non-auth) refresh failure', async () => {
    mockedRefresh.mockRejectedValue(new ApiError(503, null, 'backend down'))

    const res = await middleware(
      makeReq('/cart', { nexio_session: expiredToken, nexio_refresh: 'rt-1' }),
    )

    // I1: a 5xx/network blip must not log the user out — cookies stay intact and
    // the request proceeds (the still-present token may be within the backend's grace).
    expect(mockedRefresh).toHaveBeenCalledWith('rt-1')
    expect(res.headers.get('location')).toBeNull()
    expect(res.cookies.get('nexio_session')?.value).toBeUndefined()
    expect(res.cookies.get('nexio_refresh')?.value).toBeUndefined()
    // The forwarded request keeps the original token intact — a transient blip
    // must not strip the session the RSC render still relies on.
    const forwarded = captor.req as NextRequest
    expect(forwarded.cookies.get('nexio_session')?.value).toBe(expiredToken)
  })

  it('leaves a still-valid session untouched', async () => {
    const res = await middleware(
      makeReq('/cart', { nexio_session: validToken, nexio_refresh: 'rt-1' }),
    )

    expect(mockedRefresh).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects to /login on a protected route with no session or refresh', async () => {
    const res = await middleware(makeReq('/cart'))

    expect(mockedRefresh).not.toHaveBeenCalled()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('clears cookies and redirects when the refresh fails on a protected route', async () => {
    mockedRefresh.mockRejectedValue(new ApiError(401, null, 'invalid'))

    const res = await middleware(
      makeReq('/cart', {
        nexio_session: expiredToken,
        nexio_refresh: 'rt-bad',
      }),
    )

    expect(mockedRefresh).toHaveBeenCalledWith('rt-bad')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
    expect(res.cookies.get('nexio_session')?.value).toBe('')
    expect(res.cookies.get('nexio_refresh')?.value).toBe('')
  })
})
