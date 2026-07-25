// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import type { ProductResponseDto } from '@/lib/api/types'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

import { ProductImageManager } from './ProductImageManager'

const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440000'
const PATH = `products/${PRODUCT_ID}/f81d4fae.jpg`

const withImage: ProductResponseDto = {
  id: PRODUCT_ID,
  name: 'Burger',
  description: 'Tasty',
  price: '25.90',
  isActive: true,
  categoryId: 'c1',
  imageUrl: 'https://cdn.example.com/old.png',
  createdAt: '',
  updatedAt: '',
}

const withoutImage: ProductResponseDto = { ...withImage, imageUrl: null }

/** Minimal XMLHttpRequest double; `autoStatus: null` leaves the PUT in flight. */
class FakeXhr {
  static last: FakeXhr | null = null
  static autoStatus: number | null = 200

  status = 0
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.last = this
  }
  open() {}
  setRequestHeader() {}
  send() {
    if (FakeXhr.autoStatus === null) return
    this.status = FakeXhr.autoStatus
    queueMicrotask(() => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 1,
        total: 2,
      } as ProgressEvent)
      this.onload?.()
    })
  }
  abort() {
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

function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn()
  for (const res of responses) fn.mockResolvedValueOnce(res)
  vi.stubGlobal('fetch', fn)
  return fn
}

function pngFile(name = 'a.png', type = 'image/png', size = 1024): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const MINTED = { signedUrl: 'https://storage.test/put?token=abc', path: PATH }

function fileInput() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!
}

/** The subset of an element's text that assistive tech would announce. */
function announcedText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return clone.textContent?.trim() ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  FakeXhr.last = null
  FakeXhr.autoStatus = 200
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProductImageManager', () => {
  it('offers Upload with no image and Replace once there is one', () => {
    const { unmount } = renderWithIntl(
      <ProductImageManager product={withoutImage} canClear />,
    )
    expect(screen.getByRole('button', { name: /upload image/i })).toBeTruthy()
    unmount()

    renderWithIntl(<ProductImageManager product={withImage} canClear />)
    expect(screen.getByRole('button', { name: /replace image/i })).toBeTruthy()
  })

  it('hides the clear control when the caller may not clear (MANAGER)', () => {
    renderWithIntl(<ProductImageManager product={withImage} canClear={false} />)
    // Uploading is ADMIN+MANAGER; clearing goes through the ADMIN-only PATCH.
    expect(screen.getByRole('button', { name: /replace image/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /remove image/i })).toBeNull()
  })

  it('has no clear control when there is no image to clear', () => {
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)
    expect(screen.queryByRole('button', { name: /remove image/i })).toBeNull()
  })

  it('uploads and renders the image from the confirm response', async () => {
    const fetchFn = mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(200, {
        ...withImage,
        imageUrl: 'https://cdn.example.com/new.png',
      }),
    )
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())

    expect(await screen.findByText(/image updated/i)).toBeTruthy()
    // Straight from the confirm response — no refetch, which could race the CDN.
    await waitFor(() =>
      expect(screen.getByAltText('Burger')).toHaveAttribute(
        'src',
        'https://cdn.example.com/new.png',
      ),
    )
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalled()
  })

  it('refuses an oversized file locally, without a network call', async () => {
    const fetchFn = mockFetchSequence()
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(
      fileInput(),
      pngFile('big.png', 'image/png', 6 * 1024 * 1024),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('refuses an SVG renamed to .png locally', async () => {
    const fetchFn = mockFetchSequence()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    // `fireEvent` rather than `user.upload`, which honours the `accept`
    // attribute the way a normal file picker does. This is the "all files"
    // escape hatch — precisely the case `accept` cannot cover and the reason
    // the type check exists.
    fireEvent.change(fileInput(), {
      target: { files: [pngFile('sneaky.png', 'image/svg+xml')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /png, jpeg or webp/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('tells the user to back off on a 429 at mint', async () => {
    mockFetchSequence(jsonResponse(429, { code: 'rate_limited' }))
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /too many upload attempts/i,
    )
  })

  it('shows "try again" on a confirm 404, and the retry succeeds', async () => {
    mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(404, { code: 'upload_incomplete' }),
      jsonResponse(201, {
        ...MINTED,
        path: `products/${PRODUCT_ID}/second.png`,
      }),
      jsonResponse(200, {
        ...withImage,
        imageUrl: 'https://cdn.example.com/retry.png',
      }),
    )
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /did not complete/i,
    )

    // Re-picking the same file must still fire `change` — the input is reset.
    await user.upload(fileInput(), pngFile())
    expect(await screen.findByText(/image updated/i)).toBeTruthy()
  })

  it('shows a distinct message when the bytes are rejected (422)', async () => {
    mockFetchSequence(
      jsonResponse(201, MINTED),
      jsonResponse(422, { code: 'image_rejected' }),
    )
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())

    expect(await screen.findByRole('alert')).toHaveTextContent(/was rejected/i)
  })

  it('cancels an in-flight upload without confirming it', async () => {
    FakeXhr.autoStatus = null // the PUT never completes
    const fetchFn = mockFetchSequence(jsonResponse(201, MINTED))
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())
    const cancel = await screen.findByRole('button', { name: /cancel upload/i })
    await user.click(cancel)

    // Back to idle, no error shown, and confirm was never called — confirming a
    // cancelled upload would either 404 or publish a partial file.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /cancel upload/i }),
      ).toBeNull(),
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('keeps the percentage out of the polite live region', async () => {
    // upload.onprogress fires many times a second; interpolating the percent
    // into the live region makes a screen reader announce every tick.
    FakeXhr.autoStatus = null
    mockFetchSequence(jsonResponse(201, MINTED))
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())

    const status = await screen.findByRole('status')
    // `textContent` ignores aria-hidden, so strip those nodes to get at what a
    // screen reader would actually announce.
    expect(announcedText(status)).toBe('Uploading…')
    expect(announcedText(status)).not.toMatch(/\d+%/)
    // The number is still on screen, just not in the announced text.
    expect(status.textContent).toMatch(/\d+%/)

    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/%/))
    expect(bar).toHaveAttribute('aria-label', 'Upload progress')
  })

  it('takes the hidden file input out of the a11y tree and tab order', async () => {
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)
    const input = fileInput()
    // sr-only clips but does not unfocus; without these a keyboard user hits
    // an unlabeled file control and then the button that drives it.
    expect(input).toHaveAttribute('aria-hidden', 'true')
    expect(input).toHaveAttribute('tabindex', '-1')
  })

  it('announces "no image" for the fallback, which is aria-hidden', () => {
    const { unmount } = renderWithIntl(
      <ProductImageManager product={withoutImage} canClear />,
    )
    expect(screen.getByText(/no image set/i)).toBeTruthy()
    unmount()

    renderWithIntl(<ProductImageManager product={withImage} canClear />)
    expect(screen.queryByText(/no image set/i)).toBeNull()
  })

  it('stops offering cancel once confirm is in flight', async () => {
    // The bytes are already in the bucket by then. Aborting our own request
    // would not un-run the handler: the server would take the new image while
    // the UI silently kept showing the old one.
    const neverResolves = new Promise<Response>(() => {})
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, MINTED))
      .mockReturnValueOnce(neverResolves)
    vi.stubGlobal('fetch', fetchFn)

    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withoutImage} canClear />)

    await user.upload(fileInput(), pngFile())

    expect(await screen.findByText(/finishing/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /cancel upload/i })).toBeNull()
  })

  it('shows in-flight feedback while the image is being removed', async () => {
    const neverResolves = new Promise<Response>(() => {})
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(neverResolves))
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withImage} canClear />)

    await user.click(screen.getByRole('button', { name: /remove image/i }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('button', { name: /remove image/i }),
    )

    expect(await screen.findByText(/removing image/i)).toBeTruthy()
  })

  it('clears the image with an explicit null patch after confirming', async () => {
    const fetchFn = mockFetchSequence(
      jsonResponse(200, { ...withImage, imageUrl: null }),
    )
    const user = userEvent.setup()
    renderWithIntl(<ProductImageManager product={withImage} canClear />)

    await user.click(screen.getByRole('button', { name: /remove image/i }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('button', { name: /remove image/i }),
    )

    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(`/api/products/${PRODUCT_ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ imageUrl: null })
    await waitFor(() => expect(screen.queryByAltText('Burger')).toBeNull())
  })
})
