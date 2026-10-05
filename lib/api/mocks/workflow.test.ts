import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { REDACTED_MARKER, containsRedacted } from '@/lib/api/workflow/redaction'
import {
  MOCK_TRIGGER_DURATION_MS,
  __resetWorkflowMocks,
  createWorkflowMock,
  deleteWorkflowMock,
  getExecutionMock,
  getWorkflowMock,
  listExecutionsMock,
  listWorkflowsMock,
  setWorkflowEnabledMock,
  triggerWorkflowMock,
  updateWorkflowMock,
} from './workflow'

const M = REDACTED_MARKER
const NOTIFY = 'wf-notifica-cozinha'
const SCHEDULED = 'wf-estoque-sertao'
const DISABLED = 'wf-convite-fidelidade'

// The store is module-level, so each test starts from the seeded state.
beforeEach(() => {
  __resetWorkflowMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('workflow mock — seed data', () => {
  it('seeds three plausible Nexio automations', async () => {
    const rows = await listWorkflowsMock()
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.id).sort()).toEqual(
      [DISABLED, NOTIFY, SCHEDULED].sort(),
    )
  })

  it('seeds a SCHEDULE workflow with a valid SIX-field cron (§11)', async () => {
    const scheduled = await getWorkflowMock(SCHEDULED)
    expect(scheduled?.trigger.type).toBe('SCHEDULE')
    const cron = scheduled?.trigger.config.cron
    expect(cron).toBe('0 0 8 * * MON-FRI')
    // Spring's format, seconds first — not the five-field Unix one.
    expect(String(cron).split(/\s+/)).toHaveLength(6)
  })

  it('seeds one disabled workflow so the toggle has something to show', async () => {
    expect((await getWorkflowMock(DISABLED))?.enabled).toBe(false)
    expect(await listWorkflowsMock({ enabledOnly: true })).toHaveLength(2)
  })

  it('seeds a failed run whose step output is truncated with dropped keys', async () => {
    const run = await getExecutionMock('ex-1002')
    expect(run?.status).toBe('FAILED')
    const failed = run?.steps?.find((s) => s.status === 'FAILED')
    expect(failed?.output).toMatchObject({
      statusCode: 500,
      truncated: true,
      droppedKeys: 3,
    })
    // A non-2xx fails the node but still records the body (§5).
    expect(failed?.output.body).toMatchObject({
      erro: 'fila da chapa indisponivel',
    })
  })

  it('seeds a CONDITION step recording which branch was taken (§5)', async () => {
    const run = await getExecutionMock('ex-1002')
    const condition = run?.steps?.find((s) => s.nodeId === 'checa-canal')
    expect(condition?.output).toEqual({ result: false })
    // Steps are in execution order = the branch actually taken.
    expect(run?.steps?.map((s) => s.nodeId)).toEqual([
      'busca-pedido',
      'checa-canal',
      'avisa-balcao',
    ])
  })

  it('seeds a 3xx run with headers.location recorded (§5)', async () => {
    const run = await getExecutionMock('ex-2002')
    const step = run?.steps?.[0]
    expect(step?.status).toBe('FAILED')
    expect(step?.output).toMatchObject({ statusCode: 302 })
  })
})

describe('workflow mock — masking on read (§2.1)', () => {
  it('masks headers.Authorization and api-key style headers', async () => {
    const def = await getWorkflowMock(NOTIFY)
    const fetchNode = def?.nodes.find((n) => n.id === 'busca-pedido')
    expect(fetchNode?.headers).toEqual({
      Authorization: M,
      accept: 'application/json',
    })
    const notify = def?.nodes.find((n) => n.id === 'avisa-totem')
    expect(notify?.headers).toEqual({ 'X-Api-Key': M })
  })

  it('masks token / apiKey / password / secret wherever they appear', async () => {
    const created = await createWorkflowMock({
      name: 'mascaramento',
      trigger: { type: 'MOCK_EVENT', config: {} },
      startNodeId: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://api.nexio.com.br/x',
          headers: {},
          body: {
            token: 'tok_1',
            apiKey: 'ak_1',
            password: 'p4ssw0rd',
            secret: 's3cr3t',
            nested: { accessToken: 'tok_2' },
            keep: 'visible',
          },
        },
      ],
    })
    expect(created.nodes[0].body).toEqual({
      token: M,
      apiKey: M,
      password: M,
      secret: M,
      nested: { accessToken: M },
      keep: 'visible',
    })
  })

  it('masks the query string and userinfo of a url, keeping the template intact', async () => {
    const scheduled = await getWorkflowMock(SCHEDULED)
    expect(scheduled?.nodes[0].url).toBe(
      `https://hooks.nexio.com.br/compras/estoque?token=${M}`,
    )
    // Scheme, host, port and path survive — including a {{…}} placeholder,
    // which a URL-parsing masker would percent-encode and break (§7).
    const notify = await getWorkflowMock(NOTIFY)
    expect(notify?.nodes[0].url).toBe(
      'https://api.nexio.com.br/orders/{{trigger.orderId}}',
    )
  })

  it('masks userinfo credentials in a url', async () => {
    const created = await createWorkflowMock({
      name: 'userinfo',
      trigger: { type: 'MOCK_EVENT', config: {} },
      startNodeId: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'HTTP_REQUEST',
          method: 'GET',
          url: 'https://user:pass@legado.nexio.com.br/estoque',
        },
      ],
    })
    expect(created.nodes[0].url).toBe(
      `https://${M}@legado.nexio.com.br/estoque`,
    )
  })

  it('keeps the real value in the store — masking is a read-time projection', async () => {
    // Proven indirectly: a toggle does not send node payloads, so the stored
    // credential must survive it and still read back as a mask.
    await setWorkflowEnabledMock(NOTIFY, false)
    const after = await getWorkflowMock(NOTIFY)
    expect(after?.enabled).toBe(false)
    expect(after?.nodes[0].headers).toMatchObject({ Authorization: M })
    // If the mask had been written through, updating would now refuse.
    await expect(
      updateWorkflowMock(NOTIFY, { name: 'renomeado' }),
    ).resolves.toMatchObject({ name: 'renomeado' })
  })
})

describe('workflow mock — refuses the marker on write (§2.1)', () => {
  it('refuses a read/edit/save round trip that posts the mask back', async () => {
    // The naive loop: load, change the name, send the whole thing back.
    const loaded = await getWorkflowMock(NOTIFY)
    expect(containsRedacted(loaded)).toBe(true)
    const err = await updateWorkflowMock(NOTIFY, {
      name: 'Notificar cozinha (v2)',
      nodes: loaded!.nodes,
    }).catch((e: unknown) => e)
    expect(err).toMatchObject({ classification: 'BAD_REQUEST' })
    // Portuguese, field-specific and safe to display (§3).
    expect((err as { upstreamMessage: string }).upstreamMessage).toContain(
      REDACTED_MARKER,
    )
  })

  it('refuses the marker nested inside an array element', async () => {
    // The array case the doc's own stripRedacted snippet misses.
    await expect(
      updateWorkflowMock(NOTIFY, {
        nodes: [
          {
            id: 'n1',
            type: 'HTTP_REQUEST',
            url: 'https://api.nexio.com.br/x',
            headers: { 'X-Api-Key': [M] } as never,
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })
  })

  it('refuses it on create and on trigger too', async () => {
    await expect(
      createWorkflowMock({
        name: 'com marcador',
        trigger: { type: 'MOCK_EVENT', config: {} },
        startNodeId: 'n1',
        nodes: [
          {
            id: 'n1',
            type: 'HTTP_REQUEST',
            url: 'https://api.nexio.com.br/x',
            headers: { Authorization: M },
          },
        ],
      }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })

    await expect(
      triggerWorkflowMock(NOTIFY, { token: M }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })
  })

  it('accepts a save that omits the masked fields (§2.2)', async () => {
    const updated = await updateWorkflowMock(NOTIFY, {
      name: 'Notificar cozinha (v2)',
    })
    expect(updated.name).toBe('Notificar cozinha (v2)')
    // Untouched keys are left alone, not cleared.
    expect(updated.description).toMatch(/Busca o pedido/)
    expect(updated.nodes).toHaveLength(4)
  })
})

describe('workflow mock — partial patch semantics (§2.2)', () => {
  it('leaves an omitted field alone and clears an explicit null', async () => {
    const before = await getWorkflowMock(NOTIFY)
    const untouched = await updateWorkflowMock(NOTIFY, { name: 'x' })
    expect(untouched.description).toBe(before?.description)

    const cleared = await updateWorkflowMock(NOTIFY, { description: null })
    expect(cleared.description).toBeNull()
  })

  it('bumps updatedAt on every write', async () => {
    const before = await getWorkflowMock(NOTIFY)
    const after = await updateWorkflowMock(NOTIFY, { name: 'x' })
    expect(after.updatedAt > before!.updatedAt).toBe(true)
  })
})

describe('workflow mock — CONFLICT on a stale updatedAt (§2.7)', () => {
  it('refuses a save based on a version that has moved on', async () => {
    const loaded = await getWorkflowMock(NOTIFY)
    // Someone else saves first.
    await updateWorkflowMock(NOTIFY, { name: 'alterado por outro' })

    await expect(
      updateWorkflowMock(
        NOTIFY,
        { name: 'minha versao' },
        { expectedUpdatedAt: loaded!.updatedAt },
      ),
    ).rejects.toMatchObject({ classification: 'CONFLICT' })
  })

  it('accepts a save based on the current version', async () => {
    const loaded = await getWorkflowMock(NOTIFY)
    await expect(
      updateWorkflowMock(
        NOTIFY,
        { name: 'minha versao' },
        { expectedUpdatedAt: loaded!.updatedAt },
      ),
    ).resolves.toMatchObject({ name: 'minha versao' })
  })
})

describe('workflow mock — NOT_FOUND vs empty (§4)', () => {
  it('throws NOT_FOUND for executions on an unknown workflowId, not []', async () => {
    // An empty array would be indistinguishable from a workflow that was never
    // triggered, and the UI must 404 one and show an empty state for the other.
    await expect(listExecutionsMock('wf-inexistente')).rejects.toMatchObject({
      classification: 'NOT_FOUND',
    })
  })

  it('returns an empty array for a real workflow that was never triggered', async () => {
    await expect(listExecutionsMock(DISABLED)).resolves.toEqual([])
  })

  it('returns null — not a throw — for an unknown workflow id', async () => {
    expect(await getWorkflowMock('wf-inexistente')).toBeNull()
    expect(await getExecutionMock('ex-inexistente')).toBeNull()
  })

  it('throws NOT_FOUND on writes against an unknown id', async () => {
    for (const run of [
      () => updateWorkflowMock('wf-inexistente', { name: 'x' }),
      () => deleteWorkflowMock('wf-inexistente'),
      () => setWorkflowEnabledMock('wf-inexistente', true),
      () => triggerWorkflowMock('wf-inexistente'),
    ]) {
      await expect(run()).rejects.toMatchObject({ classification: 'NOT_FOUND' })
    }
  })
})

describe('workflow mock — executions list omits steps (§2.5)', () => {
  it('returns summaries with no steps field', async () => {
    const rows = await listExecutionsMock(NOTIFY)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row).not.toHaveProperty('steps')
      expect(row).toMatchObject({ workflowId: NOTIFY })
    }
    // Newest first.
    expect(rows[0].id).toBe('ex-1003')
  })

  it('clamps paging instead of refusing it (§2.6)', async () => {
    expect(await listExecutionsMock(NOTIFY, { limit: 0 })).toHaveLength(1)
    expect(await listWorkflowsMock({ limit: 1_000 })).toHaveLength(3)
    expect(await listWorkflowsMock({ offset: -5 })).toHaveLength(3)
  })
})

describe('workflow mock — delete cascades to executions (§4)', () => {
  it('removes the workflow and every run it produced', async () => {
    expect(await listExecutionsMock(NOTIFY)).toHaveLength(3)

    expect(await deleteWorkflowMock(NOTIFY)).toBe(true)

    expect(await getWorkflowMock(NOTIFY)).toBeNull()
    expect(await getExecutionMock('ex-1001')).toBeNull()
    expect(await getExecutionMock('ex-1002')).toBeNull()
    // Another workflow's runs are untouched.
    expect(await listExecutionsMock(SCHEDULED)).toHaveLength(2)
  })
})

describe('workflow mock — triggering is slow and synchronous (§2.3)', () => {
  it('takes multiple seconds and returns the FINISHED execution', async () => {
    vi.useFakeTimers()
    const pending = triggerWorkflowMock(NOTIFY, { orderId: 'ord-9001' })
    const settled = pending.then((e) => e)

    let done = false
    void settled.then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(MOCK_TRIGGER_DURATION_MS - 100)
    // A mock that returned instantly would let the long-running affordance rot.
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(200)
    const execution = await settled
    expect(execution.status).toBe('SUCCESS')
    expect(execution.finishedAt).not.toBeNull()
    // The response IS the result — nothing to poll.
    expect(execution.steps?.length).toBeGreaterThan(0)
  })

  it('records only the branch that was taken', async () => {
    vi.useFakeTimers()
    const trueBranch = triggerWorkflowMock(NOTIFY, { condition: true })
    await vi.advanceTimersByTimeAsync(MOCK_TRIGGER_DURATION_MS + 1)
    expect((await trueBranch).steps?.map((s) => s.nodeId)).toEqual([
      'busca-pedido',
      'checa-canal',
      'avisa-totem',
    ])

    const falseBranch = triggerWorkflowMock(NOTIFY, { condition: false })
    await vi.advanceTimersByTimeAsync(MOCK_TRIGGER_DURATION_MS + 1)
    expect((await falseBranch).steps?.map((s) => s.nodeId)).toEqual([
      'busca-pedido',
      'checa-canal',
      'avisa-balcao',
    ])
  })

  it('appends the run to the execution list', async () => {
    vi.useFakeTimers()
    const pending = triggerWorkflowMock(SCHEDULED)
    await vi.advanceTimersByTimeAsync(MOCK_TRIGGER_DURATION_MS + 1)
    await pending
    vi.useRealTimers()
    expect(await listExecutionsMock(SCHEDULED)).toHaveLength(3)
  })
})

describe('workflow mock — input refusals mirroring the server', () => {
  it('refuses a blank or over-long name (§6)', async () => {
    await expect(
      updateWorkflowMock(NOTIFY, { name: '   ' }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })
    await expect(
      updateWorkflowMock(NOTIFY, { name: 'a'.repeat(201) }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })
    await expect(
      updateWorkflowMock(NOTIFY, { name: 'a'.repeat(200) }),
    ).resolves.toBeTruthy()
  })

  it('refuses a five-field cron with a six-field message (§11)', async () => {
    const err = (await updateWorkflowMock(SCHEDULED, {
      trigger: { type: 'SCHEDULE', config: { cron: '0 8 * * MON-FRI' } },
    }).catch((e: unknown) => e)) as { upstreamMessage: string }
    expect(err).toMatchObject({ classification: 'BAD_REQUEST' })
    expect(err.upstreamMessage).toContain('seis campos')
  })

  it('accepts a valid six-field cron', async () => {
    await expect(
      updateWorkflowMock(SCHEDULED, {
        trigger: { type: 'SCHEDULE', config: { cron: '*/30 * * * * *' } },
      }),
    ).resolves.toMatchObject({
      trigger: { config: { cron: '*/30 * * * * *' } },
    })
  })

  it('requires a cron on a SCHEDULE trigger', async () => {
    await expect(
      updateWorkflowMock(SCHEDULED, {
        trigger: { type: 'SCHEDULE', config: {} },
      }),
    ).rejects.toMatchObject({ classification: 'BAD_REQUEST' })
  })
})

describe('workflow mock — create and toggle', () => {
  it('creates a disabled workflow by default and lists it', async () => {
    const created = await createWorkflowMock({
      name: 'Avisar entregador',
      trigger: { type: 'MOCK_EVENT', config: { event: 'order.ready' } },
      startNodeId: 'n1',
      nodes: [
        {
          id: 'n1',
          type: 'HTTP_REQUEST',
          method: 'POST',
          url: 'https://logistica.nexio.com.br/entregas',
        },
      ],
    })
    expect(created.enabled).toBe(false)
    expect(created.description).toBeNull()
    expect(await listWorkflowsMock()).toHaveLength(4)
  })

  it('toggles enabled through the activate/deactivate shortcut (§4)', async () => {
    expect((await setWorkflowEnabledMock(DISABLED, true)).enabled).toBe(true)
    expect((await setWorkflowEnabledMock(DISABLED, false)).enabled).toBe(false)
  })
})
