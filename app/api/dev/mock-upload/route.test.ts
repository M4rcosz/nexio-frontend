import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth/access')
// USE_MOCKS is resolved from the env at module load, so it has to be stubbed
// before ./route is imported — hence the dynamic imports below. Spread the
// real module: automocking `@/lib/auth/access` still evaluates it, and its
// session import needs the other exports of this one.
vi.mock('@/lib/api/client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/client')>()),
  USE_MOCKS: true,
}))

import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { resetUploads } from '@/lib/api/mocks/uploadStore'

const mockedGetAdminContext = vi.mocked(getAdminContext)

const ADMIN: AdminContext = {
  userId: 'u1',
  role: 'ADMIN',
  scopedBusinessUnitIds: null,
  scopedBusinessUnitId: null,
  manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
}

const PATH = 'products/550e8400-e29b-41d4-a716-446655440000/a.png'

function putReq(
  path: string,
  body: BodyInit,
  contentType = 'image/png',
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request(
    `http://localhost/api/dev/mock-upload?path=${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { 'content-type': contentType, ...extraHeaders },
      body,
    },
  )
}

function getReq(path: string): Request {
  return new Request(
    `http://localhost/api/dev/mock-upload?path=${encodeURIComponent(path)}`,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetUploads()
  vi.stubEnv('NODE_ENV', 'development')
  mockedGetAdminContext.mockResolvedValue(ADMIN)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('PUT/GET /api/dev/mock-upload', () => {
  it('round-trips the bytes with the stored content type', async () => {
    const { PUT, GET } = await import('./route')

    const put = await PUT(putReq(PATH, new Uint8Array([1, 2, 3])))
    expect(put.status).toBe(200)

    const got = await GET(getReq(PATH))
    expect(got.status).toBe(200)
    expect(got.headers.get('content-type')).toBe('image/png')
    expect(got.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
  })

  it('404s in production even with mocks on', async () => {
    // NEXT_PUBLIC_USE_MOCKS is a supported build mode and Vercel previews run
    // with NODE_ENV=production, so mocks alone must not keep this alive.
    vi.stubEnv('NODE_ENV', 'production')
    const { PUT, GET } = await import('./route')

    expect((await PUT(putReq(PATH, new Uint8Array([1])))).status).toBe(404)
    expect((await GET(getReq(PATH))).status).toBe(404)
  })

  it('refuses an anonymous PUT', async () => {
    mockedGetAdminContext.mockResolvedValue(null)
    const { PUT } = await import('./route')
    const res = await PUT(putReq(PATH, new Uint8Array([1])))
    expect(res.status).toBe(403)
  })

  it('refuses a content type outside the image allowlist', async () => {
    // Storing and echoing text/html would make this a same-origin stored-XSS
    // sink rather than a bucket stand-in.
    const { PUT, GET } = await import('./route')
    const res = await PUT(
      putReq(PATH, '<script>alert(1)</script>', 'text/html'),
    )
    expect(res.status).toBe(415)
    expect((await GET(getReq(PATH))).status).toBe(404)
  })

  it('refuses an oversized body from its declared length, before buffering', async () => {
    const { PUT } = await import('./route')
    const res = await PUT(
      putReq(PATH, new Uint8Array([1]), 'image/png', {
        'content-length': String(6 * 1024 * 1024),
      }),
    )
    expect(res.status).toBe(413)
  })

  it('404s a GET for a path that was never uploaded', async () => {
    const { GET } = await import('./route')
    expect((await GET(getReq('products/nope/x.png'))).status).toBe(404)
  })
})

describe('uploadStore eviction', () => {
  it('keeps the store bounded so a long session cannot exhaust memory', async () => {
    const { PUT, GET } = await import('./route')
    const path = (i: number) => `products/unit/${i}.png`

    for (let i = 0; i < 25; i++) {
      await PUT(putReq(path(i), new Uint8Array([i])))
    }

    // Oldest evicted, newest retained.
    expect((await GET(getReq(path(0)))).status).toBe(404)
    expect((await GET(getReq(path(24)))).status).toBe(200)
  })
})
