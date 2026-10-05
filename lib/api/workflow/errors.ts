// The error model for nexio-workflow (§3 of its docs/FRONTEND-INTEGRATION.md).
//
// Separate from `lib/api/errors.ts` (`ApiError`) because the two services fail
// differently: nexio-core answers with an HTTP status, while nexio-workflow
// answers **HTTP 200 with an `errors[]` array** whose entries carry
// `extensions.classification`. Collapsing them would mean inventing a fake
// status for every GraphQL failure.

/**
 * `NETWORK` and `NOT_CONFIGURED` are ours, not the server's: a transport failure
 * and "WORKFLOW_INTERNAL_URL is unset" respectively. The other four are the
 * classifications §3 documents.
 */
export type WorkflowErrorClassification =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'NETWORK'
  | 'NOT_CONFIGURED'

/**
 * Codes a route handler puts in its `{ error, code }` body, resolved by the UI
 * through `errors.codes.<code>` (the `useErrorMessage` contract). `not_found` is
 * deliberately the generic existing code rather than a workflow-specific one —
 * the copy is identical and a second key would only drift.
 */
export type WorkflowErrorCode =
  | 'workflow_invalid'
  | 'not_found'
  | 'workflow_conflict'
  | 'workflow_unavailable'
  | 'workflow_not_configured'
  | 'workflow_payload_too_large'
  | 'workflow_timeout'

export class WorkflowError extends Error {
  readonly classification: WorkflowErrorClassification
  /**
   * The raw message the workflow service sent, kept separate from `message` so
   * nothing can display it by accident. Only ever surfaced for `BAD_REQUEST` —
   * see {@link workflowErrorResponse}.
   */
  readonly upstreamMessage: string | null
  /** GraphQL error `path`, when the response carried one. */
  readonly path?: (string | number)[]
  /**
   * Narrows the response code past what the classification alone implies, for
   * the two cases where the user-facing copy should be specific: an oversized
   * body and a timeout both classify broadly but deserve their own message.
   * It never affects `fieldMessage` — that stays purely classification-driven.
   */
  readonly code?: WorkflowErrorCode

  constructor(
    classification: WorkflowErrorClassification,
    message: string,
    options: {
      upstreamMessage?: string | null
      path?: (string | number)[]
      code?: WorkflowErrorCode
      cause?: unknown
    } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'WorkflowError'
    this.classification = classification
    this.upstreamMessage = options.upstreamMessage ?? null
    if (options.path) this.path = options.path
    if (options.code) this.code = options.code
  }
}

/** True for the four classifications the server itself reports (§3). */
const SERVER_CLASSIFICATIONS = new Set<string>([
  'BAD_REQUEST',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL_ERROR',
])

/**
 * Narrows an arbitrary `extensions.classification` value. Anything unrecognised
 * — including a classification the service adds later — is treated as
 * `INTERNAL_ERROR`, which is the conservative branch: generic copy, no raw
 * message shown.
 */
export function toClassification(raw: unknown): WorkflowErrorClassification {
  return typeof raw === 'string' && SERVER_CLASSIFICATIONS.has(raw)
    ? (raw as WorkflowErrorClassification)
    : 'INTERNAL_ERROR'
}

export type WorkflowErrorResponse = {
  status: number
  code: WorkflowErrorCode
  /**
   * The upstream text, for the UI to render beneath its own translated line as
   * a labelled, `lang`-tagged detail. Populated for `BAD_REQUEST` **only**.
   */
  fieldMessage: string | null
}

/**
 * Maps a {@link WorkflowError} onto what a BFF route handler should answer.
 *
 * `fieldMessage` exists because §3's `BAD_REQUEST` messages are specific,
 * human-written and safe to display ("No CONDITION 'checa' precisa definir
 * expression") — the only field-level diagnostic the server gives us. It is
 * currently Portuguese-only, so the UI shows `t('errors.codes.<code>')` as the
 * primary line and this beneath it, labelled and `lang`-tagged. **Never
 * pattern-match the text** — §3 warns against it and any backend copy edit
 * would silently break the match.
 *
 * For every other classification `fieldMessage` is `null`. That is hard-wired,
 * not conditional: an `INTERNAL_ERROR` message describes a server defect and
 * §3 says never show the raw message, so there is no code path that can leak it
 * even if a caller forgets to check the classification first.
 */
export function workflowErrorResponse(
  err: WorkflowError,
): WorkflowErrorResponse {
  const mapped = mapClassification(err)
  // An explicit code narrows the copy (payload too large, timeout) but can never
  // widen what is disclosed: status and fieldMessage both stay derived from the
  // classification above.
  return err.code ? { ...mapped, code: err.code } : mapped
}

function mapClassification(err: WorkflowError): WorkflowErrorResponse {
  switch (err.classification) {
    case 'BAD_REQUEST':
      return {
        status: 400,
        code: 'workflow_invalid',
        fieldMessage: err.upstreamMessage,
      }
    case 'NOT_FOUND':
      return { status: 404, code: 'not_found', fieldMessage: null }
    case 'CONFLICT':
      return { status: 409, code: 'workflow_conflict', fieldMessage: null }
    case 'NOT_CONFIGURED':
      // Our own misconfiguration, not the user's input: 503 would invite a
      // retry, so answer 502 like every other upstream failure and let the
      // screen render its "not configured" state from the code.
      return {
        status: 502,
        code: 'workflow_not_configured',
        fieldMessage: null,
      }
    // INTERNAL_ERROR and NETWORK both land here: a server defect and a
    // transport failure are indistinguishable to a user, and neither carries a
    // message that is safe (or useful) to show.
    default:
      return { status: 502, code: 'workflow_unavailable', fieldMessage: null }
  }
}

/**
 * Normalizes an unknown thrown value into a {@link WorkflowError}. Anything that
 * is not already one becomes `INTERNAL_ERROR` with **no** `upstreamMessage`:
 * a raw `Error` from somewhere inside the transport may carry the internal
 * service URL, so its message must not survive into a response.
 */
export function toWorkflowError(err: unknown): WorkflowError {
  if (err instanceof WorkflowError) return err
  return new WorkflowError(
    'INTERNAL_ERROR',
    'Unexpected failure while calling the workflow service.',
    { cause: err },
  )
}
