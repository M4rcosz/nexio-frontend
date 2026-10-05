// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithIntl } from '@/lib/test/intl'
import type { WorkflowDefinition } from '@/lib/api/workflow/types'

const refresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
  Link: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { WorkflowList } from './WorkflowList'

function workflow(over: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'wf-1',
    name: 'Notify the kitchen when an order is confirmed',
    description: null,
    trigger: { type: 'MOCK_EVENT', config: { event: 'order.confirmed' } },
    nodes: [
      { id: 'lookup', type: 'HTTP_REQUEST', config: {} },
      { id: 'branch', type: 'CONDITION', config: {} },
    ],
    startNodeId: 'lookup',
    enabled: true,
    createdAt: '2026-07-14T09:12:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    ...over,
  }
}

/** The desktop table; the same rows render as cards below `md`. */
function table() {
  return screen.getByRole('table')
}

afterEach(cleanup)

describe('WorkflowList', () => {
  it('renders the empty state when there are no workflows', () => {
    renderWithIntl(<WorkflowList workflows={[]} />)
    expect(screen.getByText(/no workflows yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('links each row to its definition detail page', () => {
    renderWithIntl(<WorkflowList workflows={[workflow()]} />)
    const links = within(table())
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    expect(links).toContain('/admin/workflows/wf-1')
  })

  it('summarises a MOCK_EVENT trigger with the event name', () => {
    renderWithIntl(<WorkflowList workflows={[workflow()]} />)
    expect(
      within(table()).getByText('Event · order.confirmed'),
    ).toBeInTheDocument()
  })

  // Six fields, seconds first (§11) — shown raw rather than paraphrased.
  it('summarises a SCHEDULE trigger with the cron expression verbatim', () => {
    renderWithIntl(
      <WorkflowList
        workflows={[
          workflow({
            trigger: {
              type: 'SCHEDULE',
              config: { cron: '0 0 8 * * MON-FRI' },
            },
          }),
        ]}
      />,
    )
    expect(
      within(table()).getByText('Schedule · 0 0 8 * * MON-FRI'),
    ).toBeInTheDocument()
  })

  it('falls back to the bare trigger kind when the config has no detail', () => {
    renderWithIntl(
      <WorkflowList
        workflows={[workflow({ trigger: { type: 'MOCK_EVENT', config: {} } })]}
      />,
    )
    expect(within(table()).getByText('Event')).toBeInTheDocument()
  })

  it('counts the nodes rather than listing them', () => {
    renderWithIntl(<WorkflowList workflows={[workflow()]} />)
    expect(within(table()).getByText('2 nodes')).toBeInTheDocument()
  })

  it('shows the enabled flag and offers the opposite action', () => {
    renderWithIntl(<WorkflowList workflows={[workflow({ enabled: false })]} />)
    expect(within(table()).getByText('Disabled')).toBeInTheDocument()
    expect(
      within(table()).getByRole('button', { name: 'Enable' }),
    ).toBeInTheDocument()
  })

  // CLAUDE.md: `max-width` on a `<td>` does nothing under `table-layout: auto`,
  // and a sibling `truncate` won't fire either — both have to sit on an inner
  // element. A long name is exactly what would otherwise blow the table open.
  it('caps and truncates the name on an inner element, not the cell', () => {
    renderWithIntl(<WorkflowList workflows={[workflow()]} />)
    const link = within(table()).getByRole('link', {
      name: /notify the kitchen/i,
    })
    expect(link.className).toContain('truncate')
    expect(link.className).toMatch(/max-w-/)

    const cell = link.closest('td')
    expect(cell).not.toBeNull()
    expect(cell!.className).not.toMatch(/max-w-/)
    expect(cell!.className).not.toContain('truncate')
  })
})
