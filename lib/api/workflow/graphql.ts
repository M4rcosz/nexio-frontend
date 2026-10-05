// The outbound transport for nexio-workflow: a hand-rolled typed POST to its
// single `/graphql` endpoint. No GraphQL client library — Apollo/urql exist to
// give the *browser* a normalized cache and hooks, and neither is wanted here:
// the browser never talks to this service, reads happen in RSC, and freshness is
// owned by `revalidateTag`. A second cache layer would just be a second source
// of staleness.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SIBLING OF `lib/api/client.ts` AND NOT A REUSE OF ITS `rawFetch`
//
// `rawFetch` maps **HTTP status → ApiError**. That is exactly right for
// nexio-core and exactly wrong here: GraphQL answers **HTTP 200 with an
// `errors[]` array**, so every failure — a bad graph, a missing workflow, a lost
// concurrency race — would come back through `rawFetch` as a *success* carrying
// an error body, and the 401→refresh→retry path would never fire either. The two
// services fail in different shapes, so they get two transports. See the
// matching note above `rawFetch` in `lib/api/client.ts`.
// ---------------------------------------------------------------------------
//
// Contract: /home/adminuser/projects/nexio-workflow/docs/FRONTEND-INTEGRATION.md
import { WORKFLOW_REQUEST_MAX_BYTES } from '@/lib/validation/constants'
import { WorkflowError, toClassification } from './errors'
import type { JsonValue } from './types'

/**
 * Default budget for a read. Far wider than the 4s `lib/api/client.ts` uses for
 * nexio-core, because a workflow query can traverse a large graph — and far
 * narrower than `WORKFLOW_TRIGGER_TIMEOUT_MS`, which the trigger call must pass
 * explicitly (§2.3: a run can take a bit over 40 seconds).
 */
export const WORKFLOW_READ_TIMEOUT_MS = 10_000

export type WorkflowGraphqlRequest = {
  /** One of the fixed documents in `./documents.ts`. Never caller-supplied. */
  document: string
  variables?: Record<string, unknown>
  /** Only needed if a document ever declares more than one operation. */
  operationName?: string
  /** Defaults to {@link WORKFLOW_READ_TIMEOUT_MS}. */
  timeoutMs?: number
  /**
   * RSC cache tags. Reads pass `revalidate: 0` + tags — uncached but tagged, so
   * a mutating route handler can bust them explicitly (the
   * `listAiMembershipUsage` pattern). Mutations pass none.
   */
  tags?: string[]
}

/** The envelope a GraphQL server returns, including on failure. */
type GraphqlEnvelope<T> = {
  data?: T | null
  errors?: {
    message?: string
    path?: (string | number)[]
    extensions?: { classification?: unknown }
  }[]
}

/**
 * The configured service URL, read per call rather than at module load so a
 * deployment can be reconfigured without a rebuild — and so "unset" stays a
 * runtime state the screens can render, not a boot failure (see the note in
 * `lib/env.ts`).
 */
function serviceUrl(): string | null {
  const raw = process.env.WORKFLOW_INTERNAL_URL
  return raw && raw.trim() !== '' ? raw.replace(/\/$/, '') : null
}

/**
 * Whether the workflow subsystem is usable at all. The admin screens call this
 * to render a "not configured" state instead of an error card: an unset
 * `WORKFLOW_INTERNAL_URL` is a supported configuration, not a fault.
 */
export function isWorkflowConfigured(): boolean {
  return serviceUrl() !== null
}

/**
 * Reads the session cookie and returns a bearer header — **only** when
 * `WORKFLOW_FORWARD_JWT === 'true'`.
 *
 * Today the service authenticates nothing (§9), so forwarding by default would
 * hand our access token to something that will not verify it: pure credential
 * exposure for zero benefit. The code path ships now and the env var flips when
 * the backend is ready.
 *
 * Deliberately no 401→refresh→retry loop here: that logic already exists in
 * `serverFetch` (`lib/api/client.ts`) and duplicating it before there is a 401 to
 * catch would mean maintaining two copies of the trickiest path in the repo.
 * When §9 lands, wire this through the same helper rather than re-implementing.
 */
async function authorizationHeader(): Promise<string | null> {
  if (process.env.WORKFLOW_FORWARD_JWT !== 'true') return null
  // Imported lazily: `next/headers` throws outside a request scope, and with
  // forwarding off this module must stay usable anywhere.
  const { SESSION_COOKIE } = await import('@/lib/api/client')
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  return token ? `Bearer ${token}` : null
}

/**
 * Sends one operation and returns its `data`.
 *
 * Throws {@link WorkflowError} — never a bare `Error` and never anything holding
 * `WORKFLOW_INTERNAL_URL`, since these messages travel up to route handlers and
 * logs. Failure modes, in the order they are checked:
 *
 * 1. `NOT_CONFIGURED` — the service URL is unset. No request is made.
 * 2. `BAD_REQUEST` / `workflow_payload_too_large` — the serialized body exceeds
 *    256 KB (§2.7). Checked **before** the fetch: there is no point spending a
 *    round trip to be told 413, and the 413 body itself says nothing useful.
 * 3. `NETWORK` — the fetch threw, or our own timeout aborted it.
 * 4. non-2xx — a transport or deployment problem, because a *GraphQL* error
 *    arrives as HTTP 200. 413 is the one meaningful case; the rest collapse to
 *    `INTERNAL_ERROR` and the response body is never echoed.
 * 5. `errors[]` present — classified from `extensions.classification` (§3).
 * 6. `data == null` with no `errors` — a protocol violation, so `INTERNAL_ERROR`.
 */
export async function workflowGraphql<T>({
  document,
  variables,
  operationName,
  timeoutMs = WORKFLOW_READ_TIMEOUT_MS,
  tags,
}: WorkflowGraphqlRequest): Promise<T> {
  const base = serviceUrl()
  if (!base) {
    throw new WorkflowError(
      'NOT_CONFIGURED',
      'The workflow service is not configured (WORKFLOW_INTERNAL_URL is unset).',
      { code: 'workflow_not_configured' },
    )
  }

  // Serialize once: the size guard and the request body must agree, and
  // `JSON.stringify` is where `undefined` gets dropped while `null` survives —
  // the distinction the partial-patch mutation depends on (§2.2).
  const payload = JSON.stringify({
    query: document,
    variables: variables ?? {},
    operationName,
  })
  // Bytes, not characters: the cap is on the wire size, and any non-ASCII inside
  // a header value or trigger payload costs more than one byte apiece.
  const byteLength = new TextEncoder().encode(payload).length
  if (byteLength > WORKFLOW_REQUEST_MAX_BYTES) {
    throw new WorkflowError(
      'BAD_REQUEST',
      `Request body is ${byteLength} bytes, over the ${WORKFLOW_REQUEST_MAX_BYTES}-byte limit.`,
      { code: 'workflow_payload_too_large' },
    )
  }

  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
  })
  const authorization = await authorizationHeader()
  if (authorization) headers.set('authorization', authorization)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
      // Uncached but tagged, so a mutation can invalidate a read explicitly.
      // Scheduled workflows also produce executions with no mutation of ours to
      // hook (§11), which is a second reason never to time-cache these.
      next: tags?.length ? { revalidate: 0, tags } : undefined,
    })
  } catch (err) {
    const aborted = controller.signal.aborted
    // `err.message` can carry the host and port of the internal service
    // (`connect ECONNREFUSED 10.0.0.7:8080`), so it is kept out of the message
    // entirely and preserved only as `cause` for server-side logging.
    throw new WorkflowError(
      'NETWORK',
      aborted
        ? `The workflow service did not respond within ${timeoutMs}ms.`
        : 'The workflow service could not be reached.',
      { cause: err, code: aborted ? 'workflow_timeout' : undefined },
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    // A GraphQL error would have been HTTP 200, so this is our problem, not the
    // user's input — with one exception worth its own message.
    if (res.status === 413) {
      throw new WorkflowError(
        'BAD_REQUEST',
        'The workflow service rejected the request body as too large.',
        { code: 'workflow_payload_too_large' },
      )
    }
    throw new WorkflowError(
      'INTERNAL_ERROR',
      `The workflow service answered HTTP ${res.status}.`,
    )
  }

  let envelope: GraphqlEnvelope<T>
  try {
    envelope = (await res.json()) as GraphqlEnvelope<T>
  } catch (err) {
    throw new WorkflowError(
      'INTERNAL_ERROR',
      'The workflow service returned a malformed response.',
      { cause: err },
    )
  }

  const first = envelope.errors?.[0]
  if (first) {
    // Any error fails the whole call, even alongside partial `data`: almost every
    // field in the schema is non-null, so partial data here means a hole
    // somewhere the UI would have to guess about.
    const classification = toClassification(first.extensions?.classification)
    throw new WorkflowError(
      classification,
      `The workflow service reported ${classification}.`,
      {
        // Kept for BAD_REQUEST's sake only — §3's messages there are specific,
        // human-written and safe to display. `workflowErrorResponse` decides
        // what is actually disclosed; an INTERNAL_ERROR message never is.
        upstreamMessage:
          typeof first.message === 'string' ? first.message : null,
        path: first.path,
      },
    )
  }

  if (envelope.data === null || envelope.data === undefined) {
    throw new WorkflowError(
      'INTERNAL_ERROR',
      'The workflow service returned no data and no errors.',
    )
  }

  return envelope.data
}

/**
 * Narrowing helper for the `JSON` scalar: the schema types `output`, `headers`,
 * `body`, `config` and `triggerPayload` as an arbitrary object, so a value that
 * arrives as a bare scalar or array must not crash a render.
 */
export function asJsonObject(value: JsonValue | undefined): {
  [key: string]: JsonValue
} {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : {}
}
