// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let pathname = '/'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

import { Shell } from '@/components/layout/Shell'

afterEach(cleanup)

describe('Shell', () => {
  it('renders the tag it is asked for and keeps the caller classes', () => {
    pathname = '/cart'
    render(
      <Shell as="main" tier="content" className="flex-1 py-5">
        <p>body</p>
      </Shell>,
    )
    const main = screen.getByRole('main')
    expect(main.className).toBe('shell shell-content flex-1 py-5')
  })

  it('resolves the tier from the live pathname, not the server one', () => {
    // A soft navigation does not re-render the layout, so the server-resolved
    // tier goes stale — the client pathname is the source of truth.
    pathname = '/login'
    render(
      <Shell as="main" tier="wide">
        <p>body</p>
      </Shell>,
    )
    expect(screen.getByRole('main')).toHaveClass('shell-prose')
  })

  it('clamps the prose tier for the nav', () => {
    pathname = '/login'
    render(
      <Shell clamp tier="prose">
        <p>nav</p>
      </Shell>,
    )
    expect(screen.getByText('nav').parentElement).toHaveClass('shell-content')
  })

  it('falls back to the server tier when the pathname is unknown', () => {
    pathname = ''
    render(
      <Shell as="main" tier="wide">
        <p>body</p>
      </Shell>,
    )
    expect(screen.getByRole('main')).toHaveClass('shell-wide')
  })
})
