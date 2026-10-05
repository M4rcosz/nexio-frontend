// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'
import { REDACTED_MARKER } from '@/lib/api/workflow/redaction'
import type { WorkflowNode } from '@/lib/api/workflow/types'

import { NodeSummaryList } from './NodeSummaryList'

function httpNode(over: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'lookup',
    type: 'HTTP_REQUEST',
    method: 'GET',
    url: 'https://api.nexio.com.br/orders/{{trigger.orderId}}',
    headers: { accept: 'application/json' },
    body: null,
    expression: null,
    config: {},
    nextOnSuccess: 'branch',
    nextOnTrue: null,
    nextOnFalse: null,
    ...over,
  }
}

function conditionNode(over: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'branch',
    type: 'CONDITION',
    method: null,
    url: null,
    headers: null,
    body: null,
    expression: "#outputs['lookup']['body']['channel'] == 'TOTEM'",
    config: {},
    nextOnSuccess: null,
    nextOnTrue: 'tell-totem',
    nextOnFalse: 'tell-counter',
    ...over,
  }
}

afterEach(cleanup)

describe('NodeSummaryList', () => {
  it('says so when the graph is empty', () => {
    renderWithIntl(<NodeSummaryList nodes={[]} startNodeId={null} />)
    expect(screen.getByText(/no nodes/i)).toBeInTheDocument()
  })

  it('renders the nodes in array order — the order they run', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[httpNode(), conditionNode()]}
        startNodeId="lookup"
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('lookup')
    expect(items[1]).toHaveTextContent('branch')
  })

  it('marks only the start node', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[httpNode(), conditionNode()]}
        startNodeId="lookup"
      />,
    )
    expect(screen.getAllByText('Start')).toHaveLength(1)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Start')
  })

  it('shows an HTTP node with its method, url and headers', () => {
    renderWithIntl(<NodeSummaryList nodes={[httpNode()]} startNodeId={null} />)
    expect(screen.getByText('HTTP request')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(
      screen.getByText('https://api.nexio.com.br/orders/{{trigger.orderId}}'),
    ).toBeInTheDocument()
    expect(screen.getByText('accept')).toBeInTheDocument()
  })

  // The field set is symmetric per type (§6): showing a CONDITION an empty
  // "URL" row would suggest it is settable.
  it('shows a CONDITION node with its branches and no HTTP fields', () => {
    renderWithIntl(
      <NodeSummaryList nodes={[conditionNode()]} startNodeId={null} />,
    )
    expect(screen.getByText('Condition')).toBeInTheDocument()
    expect(
      screen.getByText("#outputs['lookup']['body']['channel'] == 'TOTEM'"),
    ).toBeInTheDocument()
    expect(screen.getByText('tell-totem')).toBeInTheDocument()
    expect(screen.getByText('tell-counter')).toBeInTheDocument()
    expect(screen.queryByText('URL')).not.toBeInTheDocument()
    expect(screen.queryByText('Method')).not.toBeInTheDocument()
  })

  it('names the end of a branch instead of leaving it blank', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[httpNode({ nextOnSuccess: null })]}
        startNodeId={null}
      />,
    )
    expect(screen.getByText('End of the flow')).toBeInTheDocument()
  })

  // §2.1: credential-shaped values arrive as the literal `***REDACTED***`.
  // Showing that string to an operator reads like corrupted data.
  it('renders a masked header as a chip, never as the marker text', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[
          httpNode({
            headers: { Authorization: REDACTED_MARKER, accept: 'text/plain' },
          }),
        ]}
        startNodeId={null}
      />,
    )
    expect(screen.getByText('Hidden for security')).toBeInTheDocument()
    expect(screen.queryByText(REDACTED_MARKER)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(REDACTED_MARKER)
    // The unmasked sibling is untouched.
    expect(screen.getByText('text/plain')).toBeInTheDocument()
  })

  // A url is masked *in place*, so the marker is a fragment of the value and a
  // whole-value comparison would miss it.
  it('swaps an in-place mask inside a url while keeping the host visible', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[
          httpNode({
            url: `https://hooks.nexio.com.br/compras?token=${REDACTED_MARKER}`,
          }),
        ]}
        startNodeId={null}
      />,
    )
    expect(document.body.textContent).not.toContain(REDACTED_MARKER)
    expect(screen.getByText('Hidden for security')).toBeInTheDocument()
    expect(
      screen.getByText(/hooks\.nexio\.com\.br\/compras\?token=/),
    ).toBeInTheDocument()
  })

  it('masks a marker nested inside a body object too', () => {
    renderWithIntl(
      <NodeSummaryList
        nodes={[
          httpNode({
            body: { credentials: { apiKey: REDACTED_MARKER }, unit: 'savassi' },
          }),
        ]}
        startNodeId={null}
      />,
    )
    expect(document.body.textContent).not.toContain(REDACTED_MARKER)
    expect(screen.getByText('Hidden for security')).toBeInTheDocument()
  })
})
