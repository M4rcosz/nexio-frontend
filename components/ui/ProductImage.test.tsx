// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProductImage } from './ProductImage'

afterEach(cleanup)

function img() {
  return document.querySelector('img')
}

describe('ProductImage', () => {
  it('renders the image for an absolute https URL', () => {
    render(<ProductImage src="https://cdn.example.com/a.jpg" alt="Açaí" />)
    expect(img()).toHaveAttribute('src', 'https://cdn.example.com/a.jpg')
  })

  it('renders the image for a root-relative path', () => {
    render(<ProductImage src="/uploads/a.jpg" alt="Açaí" />)
    expect(img()).toHaveAttribute('src', '/uploads/a.jpg')
  })

  it('falls back when there is no src', () => {
    render(<ProductImage src={null} alt="Açaí" />)
    expect(img()).toBeNull()
    expect(screen.getByText('🍲')).toBeInTheDocument()
  })

  // Seed rows carrying values like `@example4.com` made the browser resolve
  // them against the *current page*, so /admin/products fired real requests at
  // /admin/@example4.com on our own origin. A bare relative value is bad data.
  //
  // `//host` and `/\host` are the ones worth pinning: they look root-relative,
  // so a naive `startsWith('/')` waves them through, but the browser resolves
  // both against the page *scheme* and loads them off-origin.
  it.each([
    '@example4.com',
    'products/a.jpg',
    '../secret',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    '//evil.example/a.jpg',
    '/\\evil.example/a.jpg',
  ])('falls back rather than rendering %s as a src', (src) => {
    render(<ProductImage src={src} alt="Açaí" />)
    expect(img()).toBeNull()
    expect(screen.getByText('🍲')).toBeInTheDocument()
  })
})

describe('ProductImage — load failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * jsdom never fetches, so `complete`/`naturalWidth` have to be forced to the
   * shape a real browser leaves behind for the case under test.
   */
  function stubImageState(complete: boolean, naturalWidth: number) {
    vi.spyOn(
      window.HTMLImageElement.prototype,
      'complete',
      'get',
    ).mockReturnValue(complete)
    vi.spyOn(
      window.HTMLImageElement.prototype,
      'naturalWidth',
      'get',
    ).mockReturnValue(naturalWidth)
  }

  it('falls back when the image errors after mount', () => {
    render(<ProductImage src="https://cdn.example.com/gone.jpg" alt="Açaí" />)
    fireEvent.error(img()!)
    expect(img()).toBeNull()
    expect(screen.getByText('🍲')).toBeInTheDocument()
  })

  // The menu is server-rendered: the browser fetches the image while parsing
  // the HTML, so a 404/dead-host failure lands before React hydrates and
  // attaches `onError` — and React does not replay media error events. Without
  // the mount-time re-check the broken-image icon stayed on screen forever.
  it('falls back for an image that already failed before hydration', () => {
    stubImageState(true, 0)
    render(<ProductImage src="https://cdn.example.com/gone.jpg" alt="Açaí" />)
    expect(img()).toBeNull()
    expect(screen.getByText('🍲')).toBeInTheDocument()
  })

  it('keeps an image that completed successfully', () => {
    stubImageState(true, 640)
    render(<ProductImage src="https://cdn.example.com/a.jpg" alt="Açaí" />)
    expect(img()).toHaveAttribute('src', 'https://cdn.example.com/a.jpg')
  })

  // Still in flight at hydration: `onError` is attached in time, so the
  // mount-time check must not pre-emptively blank it.
  it('keeps an image that is still loading at mount', () => {
    stubImageState(false, 0)
    render(<ProductImage src="https://cdn.example.com/slow.jpg" alt="Açaí" />)
    expect(img()).toHaveAttribute('src', 'https://cdn.example.com/slow.jpg')
  })
})

/**
 * The allowlist is read at module load, so each case needs a fresh import with
 * the env already stubbed.
 */
describe('ProductImage — storage host allowlist', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function renderWith(hosts: string, src: string) {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_HOSTNAMES', hosts)
    vi.resetModules()
    const { ProductImage: Fresh } = await import('./ProductImage')
    render(<Fresh src={src} alt="Açaí" />)
  }

  it('renders an image on an allowed host', async () => {
    await renderWith('cdn.acme.com', 'https://cdn.acme.com/a.jpg')
    expect(img()).toHaveAttribute('src', 'https://cdn.acme.com/a.jpg')
  })

  // `imageUrl` is admin-writable and the write schema accepts any https host,
  // so an arbitrary third party would otherwise beacon every menu visitor.
  it('falls back for a host outside the allowlist', async () => {
    await renderWith('cdn.acme.com', 'https://evil.example/a.jpg')
    expect(img()).toBeNull()
    expect(screen.getByText('🍲')).toBeInTheDocument()
  })

  it('supports a *.domain glob, matching next/image', async () => {
    await renderWith('*.imgix.net', 'https://acme.imgix.net/a.jpg')
    expect(img()).toHaveAttribute('src', 'https://acme.imgix.net/a.jpg')
  })

  it('treats ** as any host', async () => {
    await renderWith('**', 'https://anything.example/a.jpg')
    expect(img()).toHaveAttribute('src', 'https://anything.example/a.jpg')
  })

  // Unset can only be a dev box: lib/env.ts hard-fails at boot in production.
  it('stays permissive when the allowlist is unset', async () => {
    await renderWith('', 'https://whatever.example/a.jpg')
    expect(img()).toHaveAttribute('src', 'https://whatever.example/a.jpg')
  })

  it('still rejects a root-relative path bypass regardless of allowlist', async () => {
    await renderWith('cdn.acme.com', '//evil.example/a.jpg')
    expect(img()).toBeNull()
  })
})
