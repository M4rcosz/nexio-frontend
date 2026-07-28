import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ProductImageUploadError,
  precheckProductImage,
  uploadProductImage,
  type UploadPhase,
} from './imageUpload'
import { PRODUCT_IMAGE_MAX_BYTES } from '@/lib/validation/constants'

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'
const PATH = `products/${PRODUCT_ID}/f81d4fae.jpg`

function file(
  { type = 'image/jpeg', size = 1024, name = 'a.jpg' } = {} as {
    type?: string
    size?: number
    name?: string
  },
): File {
  // `size` is read from the property, so a real multi-megabyte buffer is never
  // allocated just to exercise the cap.
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

/** Minimal XMLHttpRequest double: records the PUT and lets a test drive it. */
class FakeXhr {
  static last: FakeXhr | null = null
  static autoStatus: number | null = 200

  method = ''
  url = ''
  headers: Record<string, string> = {}
  status = 0
  sent: unknown = null
  aborted = false
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value
  }

  send(body: unknown) {
    this.sent = body
    if (FakeXhr.autoStatus === null) return // left in flight for the test
    this.status = FakeXhr.autoStatus
    queueMicrotask(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 5,
        total: 10,
      } as ProgressEvent)
      this.onload?.()
    })
  }

  abort() {
    this.aborted = true
    this.onabort?.()
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

/** Queues one response per call, in order. */
function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn()
  for (const res of responses) fn.mockResolvedValueOnce(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

const MINTED = { signedUrl: 'https://storage.test/put?token=abc', path: PATH }
const PRODUCT = { id: PRODUCT_ID, imageUrl: 'https://cdn.test/new.jpg' }

beforeEach(() => {
  FakeXhr.last = null
  FakeXhr.autoStatus = 200
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('precheckProductImage', () => {
  it('accepts the three allowed types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(precheckProductImage(file({ type }))).toBeNull()
    }
  })

  it('rejects an SVG even though it is an image', () => {
    expect(precheckProductImage(file({ type: 'image/svg+xml' }))).toBe(
      'invalid_type',
    )
  })

  it('rejects a .svg renamed to .png — the type is what counts', () => {
    // The rename fools the `accept` hint, not `file.type`.
    expect(
      precheckProductImage(file({ type: 'image/svg+xml', name: 'sneaky.png' })),
    ).toBe('invalid_type')
  })

  it('rejects a file over the size cap', () => {
    expect(
      precheckProductImage(file({ size: PRODUCT_IMAGE_MAX_BYTES + 1 })),
    ).toBe('too_large')
    expect(
      precheckProductImage(file({ size: PRODUCT_IMAGE_MAX_BYTES })),
    ).toBeNull()
  })
})

describe('uploadProductImage', () => {
  it('runs mint -> PUT -> confirm and returns the confirmed product', async () => {
    const fetchFn = mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(200, PRODUCT),
    )
    const phases: UploadPhase[] = []
    const progress: number[] = []

    const result = await uploadProductImage({
      productId: PRODUCT_ID,
      file: file(),
      onPhase: (p) => phases.push(p),
      onProgress: (p) => progress.push(p),
    })

    expect(result).toEqual(PRODUCT)
    expect(phases).toEqual(['minting', 'uploading', 'confirming'])
    expect(progress).toContain(0.5)

    const [mintUrl, mintInit] = fetchFn.mock.calls[0]
    expect(mintUrl).toBe(`/api/products/${PRODUCT_ID}/image/upload-url`)
    expect(JSON.parse(mintInit.body)).toEqual({ contentType: 'image/jpeg' })

    const [confirmUrl, confirmInit] = fetchFn.mock.calls[1]
    expect(confirmUrl).toBe(`/api/products/${PRODUCT_ID}/image/confirm`)
    // Verbatim: not rebuilt, not normalised, no filename appended.
    expect(JSON.parse(confirmInit.body)).toEqual({ path: PATH })
  })

  it('PUTs to the signed URL with the real content type and no Authorization', async () => {
    mockFetchSequence(jsonResponse(201, MINTED), jsonResponse(200, PRODUCT))

    await uploadProductImage({
      productId: PRODUCT_ID,
      file: file({ type: 'image/webp' }),
    })

    const xhr = FakeXhr.last!
    expect(xhr.method).toBe('PUT')
    expect(xhr.url).toBe(MINTED.signedUrl)
    expect(xhr.headers['content-type']).toBe('image/webp')
    // The credential is in the URL; our session token must not go to storage.
    expect(xhr.headers['authorization']).toBeUndefined()
  })

  it('fails the pre-check without touching the network', async () => {
    const fetchFn = mockFetchSequence()
    await expect(
      uploadProductImage({
        productId: PRODUCT_ID,
        file: file({ size: PRODUCT_IMAGE_MAX_BYTES + 1 }),
      }),
    ).rejects.toMatchObject({ code: 'too_large' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('maps a 429 at mint to rate_limited and never PUTs', async () => {
    mockFetchSequence(jsonResponse(429, { code: 'rate_limited' }))
    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'rate_limited', status: 429 })
    expect(FakeXhr.last).toBeNull()
  })

  it('discards the mint when the PUT fails — no confirm is attempted', async () => {
    FakeXhr.autoStatus = 403 // e.g. the signed credential expired
    const fetchFn = mockFetchSequence(jsonResponse(201, MINTED))

    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'upload_failed' })

    // Only the mint went out: confirming a failed upload would 404 or, worse,
    // publish a partial file.
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('maps confirm 404 to upload_incomplete', async () => {
    mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(404, { code: 'upload_incomplete' }),
    )
    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'upload_incomplete', status: 404 })
  })

  it('maps confirm 422 to image_rejected', async () => {
    mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(422, { code: 'image_rejected' }),
    )
    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'image_rejected', status: 422 })
  })

  it('mints again on retry rather than reusing the first credential', async () => {
    const secondMint = { ...MINTED, path: `products/${PRODUCT_ID}/second.jpg` }
    mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(404, { code: 'upload_incomplete' }),
      jsonResponse(201, secondMint),
      jsonResponse(200, PRODUCT),
    )

    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'upload_incomplete' })

    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).resolves.toEqual(PRODUCT)

    const fetchFn = vi.mocked(fetch)
    expect(JSON.parse(fetchFn.mock.calls[3][1]!.body as string)).toEqual({
      path: secondMint.path,
    })
  })

  it('aborts the in-flight PUT on cancel and does not confirm', async () => {
    FakeXhr.autoStatus = null // stays in flight
    const fetchFn = mockFetchSequence(jsonResponse(201, MINTED))
    const controller = new AbortController()

    const pending = uploadProductImage({
      productId: PRODUCT_ID,
      file: file(),
      signal: controller.signal,
    })

    await vi.waitFor(() => expect(FakeXhr.last).not.toBeNull())
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' })
    expect(FakeXhr.last!.aborted).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('reports a cancel during the mint as cancelled, not as a failure', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        controller.abort()
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      }),
    )

    await expect(
      uploadProductImage({
        productId: PRODUCT_ID,
        file: file(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('rejects with a ProductImageUploadError, never a bare Error', async () => {
    mockFetchSequence(jsonResponse(500, {}))
    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toBeInstanceOf(ProductImageUploadError)
  })

  it('keeps that invariant when a 2xx body is not JSON', async () => {
    // A proxy returning an HTML page with a 200 must not surface as a raw
    // SyntaxError the caller has to special-case.
    const badBody = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response
    mockFetchSequence(badBody)

    const err = await uploadProductImage({
      productId: PRODUCT_ID,
      file: file(),
    }).catch((e) => e)

    expect(err).toBeInstanceOf(ProductImageUploadError)
    expect(err).toMatchObject({ code: 'mint_failed' })
    expect(FakeXhr.last).toBeNull()
  })

  it('refuses to PUT when the mint body is missing signedUrl or path', async () => {
    mockFetchSequence(jsonResponse(201, { expiresInSeconds: 7200 }))
    await expect(
      uploadProductImage({ productId: PRODUCT_ID, file: file() }),
    ).rejects.toMatchObject({ code: 'mint_failed' })
    // Never open an XHR against `undefined`.
    expect(FakeXhr.last).toBeNull()
  })

  it('drives progress to 1 once the PUT resolves', async () => {
    mockFetchSequence(jsonResponse(201, MINTED), jsonResponse(200, PRODUCT))
    const progress: number[] = []

    await uploadProductImage({
      productId: PRODUCT_ID,
      file: file(),
      onProgress: (p) => progress.push(p),
    })

    // The browser is not obliged to emit a final lengthComputable event, so
    // the bar must be driven to 100% explicitly.
    expect(progress.at(-1)).toBe(1)
  })
})
