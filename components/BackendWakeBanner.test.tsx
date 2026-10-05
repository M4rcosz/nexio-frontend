// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import {
  createBackendStatusStore,
  type BackendStatusStore,
} from '@/lib/backend-status/store'

const refresh = vi.fn()
// Stable identity, like the real (memoized) next-intl router.
const router = { refresh }
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
}))

// Swap the shared singleton for a per-test store driven by `backendUp`.
let backendUp = true
let store: BackendStatusStore
vi.mock('@/lib/backend-status/store', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/backend-status/store')>()
  return {
    ...actual,
    get backendStatus() {
      return store
    },
  }
})

import { BackendWakeBanner } from './BackendWakeBanner'

beforeEach(() => {
  vi.clearAllMocks()
  backendUp = true
  store = createBackendStatusStore({
    probe: async () => backendUp,
    pollIntervalMs: 1000,
    giveUpAfterMs: 5000,
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BackendWakeBanner', () => {
  it('stays silent when the backend is already awake', async () => {
    renderWithIntl(<BackendWakeBanner />)
    await act(async () => {})
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('explains the cold start, then refreshes the route once it is up', async () => {
    vi.useFakeTimers()
    backendUp = false
    renderWithIntl(<BackendWakeBanner />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Waking up the server…')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()

    backendUp = true
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText('All set — the server is ready.'),
    ).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('offers a retry once it gives up', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    backendUp = false
    renderWithIntl(<BackendWakeBanner />)
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(screen.getByText("The server isn't responding")).toBeInTheDocument()

    backendUp = true
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await act(async () => {})
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
