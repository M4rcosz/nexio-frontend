import { describe, it, expect } from 'vitest'
import { headerTier, shellClass, shellTier, type ShellTier } from './shell'

describe('shellTier', () => {
  const cases: [pathname: string, tier: ShellTier][] = [
    // Prose — reading/typing surfaces.
    ['/login', 'prose'],
    ['/register', 'prose'],
    ['/profile', 'prose'],

    // Wide — dense/grid surfaces.
    ['/', 'wide'],
    ['/admin', 'wide'],
    ['/admin/orders', 'wide'],
    ['/admin/business-units/abc123', 'wide'],
    ['/ai', 'wide'],
    ['/units/abc123', 'wide'],

    // Full — kiosk.
    ['/totem', 'full'],
    ['/totem/anything', 'full'],

    // Content — the default for everything else.
    ['/pos', 'content'],
    ['/cart', 'content'],
    ['/checkout', 'content'],
    ['/orders', 'content'],
    ['/orders/abc123', 'content'],
    ['/loyalty', 'content'],
    ['/payment/abc123', 'content'],
    // A product detail page is not a grid — it stays at the default cap even
    // though its parent storefront goes wide.
    ['/units/abc123/products/p1', 'content'],
    ['/definitely-not-a-route', 'content'],
    ['/adminish', 'content'],
    ['/aid', 'content'],
    ['/units', 'content'],
  ]

  it.each(cases)('maps %s to the %s tier', (pathname, tier) => {
    expect(shellTier(pathname)).toBe(tier)
  })

  it('falls back to the content tier for an empty pathname', () => {
    // Server components that cannot resolve the pathname pass `''`. It must not
    // be treated as the home route.
    expect(shellTier('')).toBe('content')
  })

  it.each(cases)('strips the locale prefix of %s', (pathname, tier) => {
    const prefixed = pathname === '/' ? '/pt-BR' : `/pt-BR${pathname}`
    expect(shellTier(prefixed)).toBe(tier)
  })

  it.each(cases)('ignores a trailing slash on %s', (pathname, tier) => {
    expect(shellTier(pathname.endsWith('/') ? pathname : `${pathname}/`)).toBe(
      tier,
    )
  })
})

describe('shellClass', () => {
  it('pairs the base shell with the tier cap', () => {
    expect(shellClass('prose')).toBe('shell shell-prose')
    expect(shellClass('content')).toBe('shell shell-content')
    expect(shellClass('wide')).toBe('shell shell-wide')
    expect(shellClass('full')).toBe('shell shell-full')
  })
})

describe('headerTier', () => {
  it('clamps prose up to content so the nav never shrinks', () => {
    expect(headerTier('prose')).toBe('content')
  })

  it.each(['content', 'wide', 'full'] as const)('passes %s through', (tier) => {
    expect(headerTier(tier)).toBe(tier)
  })
})
