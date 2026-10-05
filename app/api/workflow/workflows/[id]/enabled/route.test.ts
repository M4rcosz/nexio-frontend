import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowError } from '@/lib/api/workflow/errors'
import type { WorkflowDefinition } from '@/lib/api/workflow/types'

vi.mock('@/lib/auth/access')
// Partial mock: only the call goes away. `workflowTags` must stay real, since
// the whole point of the assertions below is which tag strings get busted.
vi.mock('@/lib/api/workflow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/workflow')>()),
  setWorkflowEnabled: vi.fn(),
}))
// `revalidateTag` needs a Next request scope that doesn't exist under vitest.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'
import { getAdminContext, type AdminContext } from '@/lib/auth/access'
import { setWorkflowEnabled } from '@/lib/api/workflow'
import { POST } from './route'

const mockedCtx = vi.mocked(getAdminContext)
const mockedSet = vi.mocked(setWorkflowEnabled)
const mockedRevalidateTag = vi.mocked(revalidateTag)

const WORKFLOW_ID = 'wf-notifica-cozinha'

const ADMIN: AdminContext = {
  userId: 'u1',
  role: 'ADMIN',
  scopedBusinessUnitIds: null,
  scopedBusinessUnitId: null,
  manageableRoles: ['ADMIN', 'MANAGER', 'ATTENDANT', 'KITCHEN'],
}

const MANAGER: AdminContext = {
  userId: 'u2',
  role: 'MANAGER',
  scopedBusinessUnitIds: ['bu-1'],
  scopedBusinessUnitId: 'bu-1',
  manageableRoles: ['ATTENDANT', 'KITCHEN'],
}

function req(body: unknown, id = WORKFLOW_ID): Request {
  return new Request(`http://localhost/api/workflow/workflows/${id}/enabled`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(id = WORKFLOW_ID) {
  return { params: Promise.resolve({ id }) }
}

const DEFINITION: WorkflowDefinition = {
  id: WORKFLOW_ID,
  name: 'Notificar cozinha ao confirmar pedido',
  description: null,
  trigger: { type: 'MOCK_EVENT', config: { event: 'order.confirmed' } },
  nodes: [{ id: 'busca-pedido', type: 'HTTP_REQUEST', config: {} }],
  startNodeId: 'busca-pedido',
  enabled: false,
  createdAt: '2026-07-14T09:12:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/workflow/workflows/:id/enabled — access', () => {
  it('refuses an unauthenticated caller with 403', async () => {
    mockedCtx.mockResolvedValue(null)
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(403)
    expect(mockedSet).not.toHaveBeenCalled()
  })

  // The second of the two enforcement points: the sidebar hides the entry and
  // the page 404s, but a MANAGER can still post straight at this URL.
  it('refuses a MANAGER with 403', async () => {
    mockedCtx.mockResolvedValue(MANAGER)
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(403)
    expect(mockedSet).not.toHaveBeenCalled()
  })
})

describe('POST /api/workflow/workflows/:id/enabled — payload', () => {
  beforeEach(() => {
    mockedCtx.mockResolvedValue(ADMIN)
  })

  it.each([
    ['an empty body', {}],
    ['a non-boolean flag', { enabled: 'true' }],
    ['null', null],
  ])('rejects %s with 400 and no round trip', async (_label, body) => {
    const res = await POST(req(body), ctx())
    expect(res.status).toBe(400)
    expect(mockedSet).not.toHaveBeenCalled()
  })
})

describe('POST /api/workflow/workflows/:id/enabled — success', () => {
  beforeEach(() => {
    mockedCtx.mockResolvedValue(ADMIN)
  })

  it('activates and busts both the collection and the row tag', async () => {
    mockedSet.mockResolvedValue({ ...DEFINITION, enabled: true })
    const res = await POST(req({ enabled: true }), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: WORKFLOW_ID, enabled: true })
    expect(mockedSet).toHaveBeenCalledWith(WORKFLOW_ID, true)
    // Both reads are RSC-rendered and uncached-but-tagged, so without these the
    // list and the detail page keep the old flag.
    expect(mockedRevalidateTag).toHaveBeenCalledWith('workflows')
    expect(mockedRevalidateTag).toHaveBeenCalledWith(`workflow:${WORKFLOW_ID}`)
  })

  it('passes the flag through verbatim when deactivating', async () => {
    mockedSet.mockResolvedValue({ ...DEFINITION, enabled: false })
    const res = await POST(req({ enabled: false }), ctx())
    expect(res.status).toBe(200)
    expect(mockedSet).toHaveBeenCalledWith(WORKFLOW_ID, false)
  })
})

describe('POST /api/workflow/workflows/:id/enabled — failures', () => {
  beforeEach(() => {
    mockedCtx.mockResolvedValue(ADMIN)
  })

  it('maps NOT_FOUND to 404 and does not revalidate', async () => {
    mockedSet.mockRejectedValue(new WorkflowError('NOT_FOUND', 'gone'))
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'not_found' })
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
  })

  it('maps CONFLICT to 409 — a lost race is not a retry', async () => {
    mockedSet.mockRejectedValue(new WorkflowError('CONFLICT', 'raced'))
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'workflow_conflict' })
  })

  it('maps an unset service URL to 502 workflow_not_configured', async () => {
    mockedSet.mockRejectedValue(
      new WorkflowError('NOT_CONFIGURED', 'unset', {
        code: 'workflow_not_configured',
      }),
    )
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({
      code: 'workflow_not_configured',
      fieldMessage: null,
    })
  })

  // §3's BAD_REQUEST text is human-written and safe to display — it is the only
  // field-level diagnostic the service gives us.
  it('forwards the upstream message for a BAD_REQUEST', async () => {
    mockedSet.mockRejectedValue(
      new WorkflowError('BAD_REQUEST', 'refused', {
        upstreamMessage: "No CONDITION 'checa' precisa definir expression",
      }),
    )
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      code: 'workflow_invalid',
      fieldMessage: "No CONDITION 'checa' precisa definir expression",
    })
  })

  it('never echoes the message of a server-side failure', async () => {
    mockedSet.mockRejectedValue(
      new WorkflowError('INTERNAL_ERROR', 'defect', {
        upstreamMessage: 'connect ECONNREFUSED 10.0.0.7:8080',
      }),
    )
    const res = await POST(req({ enabled: true }), ctx())
    const body = (await res.json()) as Record<string, unknown>
    expect(res.status).toBe(502)
    expect(body).toMatchObject({
      code: 'workflow_unavailable',
      fieldMessage: null,
    })
    expect(JSON.stringify(body)).not.toContain('10.0.0.7')
  })

  it('normalizes a thrown non-WorkflowError into a 502', async () => {
    mockedSet.mockRejectedValue(new Error('boom'))
    const res = await POST(req({ enabled: true }), ctx())
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ code: 'workflow_unavailable' })
  })
})
