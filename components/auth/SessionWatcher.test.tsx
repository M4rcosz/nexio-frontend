// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { SessionWatcher } from '@/components/auth/SessionWatcher'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  // jsdom's `document` is shared across tests in this file — reset visibility
  // so an earlier test's "hidden" doesn't leak into the next one.
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// Regression coverage for the bug where an expired session kept showing the
// header avatar until a hard reload: the root layout's session read is only
// re-run when something forces a fresh server render, and nothing did that
// on the mere passage of time. SessionWatcher closes that gap by calling
// router.refresh() at the moments a stale session is most likely to surface.
describe('SessionWatcher', () => {
  it('renders nothing', () => {
    const { container } = render(<SessionWatcher />)
    expect(container).toBeEmptyDOMElement()
  })

  it('refreshes when the tab becomes visible again', () => {
    render(<SessionWatcher />)
    expect(refresh).not.toHaveBeenCalled()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on visibilitychange while the tab is hidden', () => {
    render(<SessionWatcher />)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes on window focus', () => {
    render(<SessionWatcher />)
    window.dispatchEvent(new Event('focus'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes periodically while the tab stays visible', () => {
    render(<SessionWatcher />)
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(<SessionWatcher />)
    unmount()
    window.dispatchEvent(new Event('focus'))
    vi.advanceTimersByTime(10 * 60 * 1000)
    expect(refresh).not.toHaveBeenCalled()
  })
})
