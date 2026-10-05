import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Backing store for the mocked next/headers, used only by the JWT-forwarding
// path. With forwarding off the module must never reach for it at all.
const cookieStore = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  }),
}))

import { WorkflowError } from './errors'
import { isWorkflowConfigured, workflowGraphql } from './graphql'

/** A recognisable internal host — no thrown message may ever contain it. */
const SERVICE_URL = 'http://workflow.internal:8080'
const SECRET_HOST = 'workflow.internal'

const fetchMock = vi.fn()

function graphqlResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  cookieStore.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('WORKFLOW_INTERNAL_URL', SERVICE_URL)
  vi.stubEnv('WORKFLOW_FORWARD_JWT', 'false')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('workflowGraphql — happy path', () => {
  it('posts the document to /graphql and returns data', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({ data: { workflow: { id: 'wf-1' } } }),
    )

    const data = await workflowGraphql<{ workflow: { id: string } }>({
      document: 'query Workflow($id: ID!) { workflow(id: $id) { id } }',
      variables: { id: 'wf-1' },
      operationName: 'Workflow',
      tags: ['workflows', 'workflow:wf-1'],
    })

    expect(data).toEqual({ workflow: { id: 'wf-1' } })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${SERVICE_URL}/graphql`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'query Workflow($id: ID!) { workflow(id: $id) { id } }',
      variables: { id: 'wf-1' },
      operationName: 'Workflow',
    })
  })

  it('passes the RSC tags through, uncached', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({ data: { workflows: [] } }),
    )
    await workflowGraphql({
      document: 'query Q { workflows { id } }',
      tags: ['workflows'],
    })
    const init = fetchMock.mock.calls[0][1] as RequestInit & {
      next?: { revalidate?: number; tags?: string[] }
    }
    expect(init.next).toEqual({ revalidate: 0, tags: ['workflows'] })
  })

  it('normalizes a trailing slash on the configured URL', async () => {
    vi.stubEnv('WORKFLOW_INTERNAL_URL', `${SERVICE_URL}/`)
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))
    await workflowGraphql({ document: 'query Q { ok }' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/graphql`)
  })
})

describe('workflowGraphql — HTTP 200 with errors[] (the reason this is not rawFetch)', () => {
  it('throws with the reported classification and never returns data', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        data: null,
        errors: [
          {
            message: "No CONDITION 'checa' precisa definir expression",
            path: ['createWorkflow'],
            extensions: { classification: 'BAD_REQUEST' },
          },
        ],
      }),
    )

    const err = await workflowGraphql({
      document: 'mutation M { createWorkflow { id } }',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(WorkflowError)
    const wfErr = err as WorkflowError
    expect(wfErr.classification).toBe('BAD_REQUEST')
    expect(wfErr.upstreamMessage).toBe(
      "No CONDITION 'checa' precisa definir expression",
    )
    expect(wfErr.path).toEqual(['createWorkflow'])
  })

  it('throws even when the 200 carries partial data alongside errors', async () => {
    // Nearly every field in the schema is non-null, so partial data means a hole
    // the UI would have to guess about.
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        data: { workflow: null },
        errors: [
          {
            message: 'nao encontrado',
            extensions: { classification: 'NOT_FOUND' },
          },
        ],
      }),
    )
    await expect(
      workflowGraphql({ document: 'query Q { workflow { id } }' }),
    ).rejects.toMatchObject({ classification: 'NOT_FOUND' })
  })

  it('maps CONFLICT and INTERNAL_ERROR through unchanged', async () => {
    for (const classification of ['CONFLICT', 'INTERNAL_ERROR'] as const) {
      fetchMock.mockResolvedValueOnce(
        graphqlResponse({
          errors: [{ message: 'x', extensions: { classification } }],
        }),
      )
      await expect(
        workflowGraphql({ document: 'mutation M { updateWorkflow { id } }' }),
      ).rejects.toMatchObject({ classification })
    }
  })

  it('treats an unknown classification as INTERNAL_ERROR', async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        errors: [{ message: 'x', extensions: { classification: 'TEAPOT' } }],
      }),
    )
    await expect(
      workflowGraphql({ document: 'query Q { workflows { id } }' }),
    ).rejects.toMatchObject({ classification: 'INTERNAL_ERROR' })
  })

  it('throws INTERNAL_ERROR when data is null with no errors', async () => {
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: null }))
    await expect(
      workflowGraphql({ document: 'query Q { workflows { id } }' }),
    ).rejects.toMatchObject({ classification: 'INTERNAL_ERROR' })
  })

  it('throws INTERNAL_ERROR on a malformed body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )
    await expect(
      workflowGraphql({ document: 'query Q { workflows { id } }' }),
    ).rejects.toMatchObject({ classification: 'INTERNAL_ERROR' })
  })
})

describe('workflowGraphql — the 256 KB body cap (§2.7)', () => {
  it('refuses an oversized body BEFORE the fetch', async () => {
    const err = await workflowGraphql({
      document:
        'mutation Trigger($payload: JSON) { triggerWorkflow(payload: $payload) { id } }',
      variables: { payload: { blob: 'x'.repeat(300 * 1024) } },
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(WorkflowError)
    expect(err).toMatchObject({
      classification: 'BAD_REQUEST',
      code: 'workflow_payload_too_large',
    })
    // The whole point: no round trip spent to be told 413.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a body that fits', async () => {
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))
    await workflowGraphql({
      document:
        'mutation M($payload: JSON) { triggerWorkflow(payload: $payload) { id } }',
      variables: { payload: { blob: 'x'.repeat(1000) } },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps an upstream 413 to the same code', async () => {
    fetchMock.mockResolvedValueOnce(graphqlResponse({}, 413))
    await expect(
      workflowGraphql({ document: 'mutation M { triggerWorkflow { id } }' }),
    ).rejects.toMatchObject({
      classification: 'BAD_REQUEST',
      code: 'workflow_payload_too_large',
    })
  })

  it('maps any other non-2xx to INTERNAL_ERROR without echoing the body', async () => {
    // A GraphQL error arrives as HTTP 200, so a non-2xx is a transport or
    // deployment problem — and its body may be a server error page.
    fetchMock.mockResolvedValueOnce(
      new Response('Whitelabel Error Page: /graphql not mapped', {
        status: 404,
      }),
    )
    const err = (await workflowGraphql({
      document: 'query Q { workflows { id } }',
    }).catch((e: unknown) => e)) as WorkflowError
    expect(err.classification).toBe('INTERNAL_ERROR')
    expect(err.message).toContain('404')
    expect(err.message).not.toContain('Whitelabel')
    expect(err.upstreamMessage).toBeNull()
  })
})

describe('workflowGraphql — transport failures never leak the internal URL', () => {
  it('maps a network throw to NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(
      new Error(`connect ECONNREFUSED ${SECRET_HOST}:8080`),
    )
    const err = (await workflowGraphql({
      document: 'query Q { workflows { id } }',
    }).catch((e: unknown) => e)) as WorkflowError

    expect(err.classification).toBe('NETWORK')
    expect(err.message).not.toContain(SECRET_HOST)
    expect(err.upstreamMessage).toBeNull()
    // The original failure survives for server-side logging only.
    expect((err.cause as Error).message).toContain(SECRET_HOST)
  })

  it('keeps the URL out of every other thrown message too', async () => {
    const cases: (() => Promise<unknown>)[] = [
      async () => {
        fetchMock.mockResolvedValueOnce(graphqlResponse({}, 500))
        return workflowGraphql({ document: 'query Q { workflows { id } }' })
      },
      async () => {
        fetchMock.mockResolvedValueOnce(graphqlResponse({ data: null }))
        return workflowGraphql({ document: 'query Q { workflows { id } }' })
      },
    ]
    for (const run of cases) {
      const err = (await run().catch((e: unknown) => e)) as WorkflowError
      expect(err.message).not.toContain(SECRET_HOST)
    }
  })

  it('aborts at the configured timeout and reports NETWORK', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new Error('The operation was aborted')),
          )
        }),
    )

    const pending = workflowGraphql({
      document: 'query Q { workflows { id } }',
      timeoutMs: 10_000,
    })
    const settled = pending.catch((e: unknown) => e)

    // Still in flight just before the budget expires.
    await vi.advanceTimersByTimeAsync(9_999)
    let done = false
    void settled.then(() => {
      done = true
    })
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(2)
    const err = (await settled) as WorkflowError
    expect(err.classification).toBe('NETWORK')
    expect(err.code).toBe('workflow_timeout')
    expect(err.message).toContain('10000ms')
    expect(err.message).not.toContain(SECRET_HOST)
  })

  it('honours a widened timeout for the long trigger call (§2.3)', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new Error('The operation was aborted')),
          )
          // A realistic worst-case run: a bit over 40 seconds.
          setTimeout(
            () => resolve(graphqlResponse({ data: { ok: true } })),
            42_000,
          )
        }),
    )

    const pending = workflowGraphql({
      document: 'mutation M { triggerWorkflow { id } }',
      timeoutMs: 60_000,
    })
    await vi.advanceTimersByTimeAsync(42_001)
    await expect(pending).resolves.toEqual({ ok: true })
  })
})

describe('workflowGraphql — configuration', () => {
  it('throws NOT_CONFIGURED without calling fetch when the URL is unset', async () => {
    vi.stubEnv('WORKFLOW_INTERNAL_URL', '')
    const err = (await workflowGraphql({
      document: 'query Q { workflows { id } }',
    }).catch((e: unknown) => e)) as WorkflowError

    expect(err.classification).toBe('NOT_CONFIGURED')
    expect(err.code).toBe('workflow_not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isWorkflowConfigured reflects the env var', () => {
    expect(isWorkflowConfigured()).toBe(true)
    vi.stubEnv('WORKFLOW_INTERNAL_URL', '')
    expect(isWorkflowConfigured()).toBe(false)
  })
})

describe('workflowGraphql — JWT forwarding (§9)', () => {
  it('sends NO authorization header while WORKFLOW_FORWARD_JWT is false', async () => {
    cookieStore.set('nexio_session', 'a.b.c')
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))

    await workflowGraphql({ document: 'query Q { workflows { id } }' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).has('authorization')).toBe(false)
  })

  it('sends no authorization header when the flag is unset either', async () => {
    vi.stubEnv('WORKFLOW_FORWARD_JWT', '')
    cookieStore.set('nexio_session', 'a.b.c')
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))
    await workflowGraphql({ document: 'query Q { workflows { id } }' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).has('authorization')).toBe(false)
  })

  it('sends Bearer <access token> when it is true', async () => {
    vi.stubEnv('WORKFLOW_FORWARD_JWT', 'true')
    cookieStore.set('nexio_session', 'a.b.c')
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))

    await workflowGraphql({ document: 'query Q { workflows { id } }' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).get('authorization')).toBe('Bearer a.b.c')
  })

  it('omits the header when forwarding is on but there is no session', async () => {
    vi.stubEnv('WORKFLOW_FORWARD_JWT', 'true')
    fetchMock.mockResolvedValueOnce(graphqlResponse({ data: { ok: true } }))
    await workflowGraphql({ document: 'query Q { workflows { id } }' })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Headers).has('authorization')).toBe(false)
  })
})
