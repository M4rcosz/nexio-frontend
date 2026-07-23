// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { AiUsageReport } from './AiUsageReport'
import type {
  AiMembershipUsage,
  AiUsageReport as AiUsageReportPage,
} from '@/lib/api/types'

function row(id: string, name: string): AiMembershipUsage {
  return {
    id,
    userId: `user-${id}`,
    userName: name,
    userEmail: `${name.toLowerCase()}@nexio.dev`,
    tokenBalance: 10_000,
    tokensUsedInPeriod: 250,
    isRevoked: false,
    revokedAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
  }
}

function page(rows: AiMembershipUsage[]): AiUsageReportPage {
  return {
    data: rows,
    meta: { limit: 20, hasMore: false, nextCursor: null },
    periodFrom: '2026-06-21T00:00:00.000Z',
    periodTo: '2026-07-21T23:59:59.999Z',
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

describe('AiUsageReport', () => {
  it('adopts a fresh server render — a new grant shows up without a reload', async () => {
    const { rerender } = renderWithIntl(
      <AiUsageReport initialReport={page([row('1', 'Ana')])} />,
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()

    // What router.refresh() produces after the manager above enrolls someone:
    // the same component, a new `initialReport` identity.
    rerender(
      <AiUsageReport
        initialReport={page([row('2', 'Bruno'), row('1', 'Ana')])}
      />,
    )
    expect(await screen.findByText('Bruno')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    // The server page was already fresh — no client round-trip needed.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('re-fetches the applied window instead of adopting the default one', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => page([row('9', 'Filtered')]),
    })

    const { rerender } = renderWithIntl(
      <AiUsageReport initialReport={page([row('1', 'Ana')])} />,
    )

    // Narrow the range, so the table no longer shows the server's own window.
    await user.click(screen.getByRole('button', { name: 'From' }))
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const applied = new URL(
      fetchMock.mock.calls[0][0] as string,
      'http://localhost',
    ).searchParams.get('from')
    expect(applied).toBeTruthy()

    fetchMock.mockClear()
    rerender(
      <AiUsageReport
        initialReport={page([row('2', 'Bruno'), row('1', 'Ana')])}
      />,
    )

    // The refreshed server page describes the default 30-day window, which is
    // not what is on screen — so it must be re-fetched under `from`, not swapped in.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toContain(
      `from=${encodeURIComponent(applied!)}`,
    )
    expect(screen.queryByText('Bruno')).not.toBeInTheDocument()
  })
})
