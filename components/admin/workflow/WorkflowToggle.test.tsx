// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

import { WorkflowToggle } from './WorkflowToggle'

function mockFetch(
  status: number,
  body: unknown = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('WorkflowToggle', () => {
  it('offers the opposite of the current state', () => {
    renderWithIntl(<WorkflowToggle id="wf-1" enabled />)
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument()
    cleanup()
    renderWithIntl(<WorkflowToggle id="wf-1" enabled={false} />)
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument()
  })

  // The dedicated sub-resource, not a partial update of the whole definition:
  // that keeps the toggle clear of the redaction trap entirely (§2.1/§4).
  it('puts the flipped flag to the enabled sub-resource and refreshes', async () => {
    const fetchMock = mockFetch(200, { id: 'wf-1', enabled: false })
    renderWithIntl(<WorkflowToggle id="wf-1" enabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflow/workflows/wf-1/enabled',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
      }),
    )
  })

  it('escapes an id that would otherwise break out of the path', async () => {
    const fetchMock = mockFetch(200)
    renderWithIntl(<WorkflowToggle id="wf/../secret" enabled={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/workflow/workflows/wf%2F..%2Fsecret/enabled',
    )
  })

  it('shows the translated message for the returned code and does not refresh', async () => {
    mockFetch(409, { code: 'workflow_conflict' })
    renderWithIntl(<WorkflowToggle id="wf-1" enabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /someone else changed this workflow first/i,
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('falls back to its own copy when the response carries no code', async () => {
    mockFetch(400, {})
    renderWithIntl(<WorkflowToggle id="wf-1" enabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not change the workflow status/i,
    )
  })

  // §3's BAD_REQUEST text is safe to show but Portuguese-only, so it goes
  // beneath the translated line and is tagged with its own language.
  it('renders the upstream field message as a lang-tagged detail', async () => {
    mockFetch(400, {
      code: 'workflow_invalid',
      fieldMessage: "No CONDITION 'checa' precisa definir expression",
    })
    renderWithIntl(<WorkflowToggle id="wf-1" enabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Disable' }))

    const detail = await screen.findByText(
      "No CONDITION 'checa' precisa definir expression",
    )
    expect(detail).toHaveAttribute('lang', 'pt-BR')
    // The translated line stays the primary message above it.
    expect(screen.getByRole('alert')).toHaveTextContent(
      /the workflow service rejected this change/i,
    )
  })
})
