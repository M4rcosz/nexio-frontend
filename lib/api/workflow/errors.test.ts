import { describe, it, expect } from 'vitest'
import {
  WorkflowError,
  toClassification,
  toWorkflowError,
  workflowErrorResponse,
} from './errors'

// A realistic upstream BAD_REQUEST message (§3) — Portuguese, field-specific.
const UPSTREAM_PT = "No CONDITION 'checa' precisa definir expression"

describe('workflowErrorResponse — classification mapping (§3)', () => {
  it('maps BAD_REQUEST to 400 with the upstream text as fieldMessage', () => {
    const res = workflowErrorResponse(
      new WorkflowError('BAD_REQUEST', 'invalid input', {
        upstreamMessage: UPSTREAM_PT,
      }),
    )
    expect(res).toEqual({
      status: 400,
      code: 'workflow_invalid',
      fieldMessage: UPSTREAM_PT,
    })
  })

  it('maps NOT_FOUND to 404 with the generic not_found code', () => {
    const res = workflowErrorResponse(
      new WorkflowError('NOT_FOUND', 'no such workflow'),
    )
    expect(res).toEqual({ status: 404, code: 'not_found', fieldMessage: null })
  })

  it('maps CONFLICT to 409 so the UI can reconcile (§2.7)', () => {
    const res = workflowErrorResponse(
      new WorkflowError('CONFLICT', 'concurrent modification'),
    )
    expect(res).toEqual({
      status: 409,
      code: 'workflow_conflict',
      fieldMessage: null,
    })
  })

  it('maps NETWORK to 502 workflow_unavailable', () => {
    const res = workflowErrorResponse(
      new WorkflowError('NETWORK', 'request timed out after 10000ms'),
    )
    expect(res).toEqual({
      status: 502,
      code: 'workflow_unavailable',
      fieldMessage: null,
    })
  })

  it('maps NOT_CONFIGURED to 502 with its own code', () => {
    const res = workflowErrorResponse(
      new WorkflowError('NOT_CONFIGURED', 'workflow service is not configured'),
    )
    expect(res).toEqual({
      status: 502,
      code: 'workflow_not_configured',
      fieldMessage: null,
    })
  })

  it('never exposes an INTERNAL_ERROR message, even when one is present', () => {
    // §3: a server defect gets a generic apology — the raw message may describe
    // internals. fieldMessage is hard-wired to null, not merely left unset.
    const res = workflowErrorResponse(
      new WorkflowError('INTERNAL_ERROR', 'server defect', {
        upstreamMessage:
          'NullPointerException at com.nexio.workflow.HttpNodeExecutor:88',
      }),
    )
    expect(res.status).toBe(502)
    expect(res.code).toBe('workflow_unavailable')
    expect(res.fieldMessage).toBeNull()
  })
})

describe('workflowErrorResponse — explicit code override', () => {
  it('narrows the code while keeping the classification status', () => {
    const res = workflowErrorResponse(
      new WorkflowError('BAD_REQUEST', 'request body is too large', {
        code: 'workflow_payload_too_large',
      }),
    )
    expect(res).toEqual({
      status: 400,
      code: 'workflow_payload_too_large',
      fieldMessage: null,
    })
  })

  it('cannot make an INTERNAL_ERROR disclose its message', () => {
    const res = workflowErrorResponse(
      new WorkflowError('INTERNAL_ERROR', 'defect', {
        upstreamMessage: 'stack trace',
        code: 'workflow_timeout',
      }),
    )
    expect(res.status).toBe(502)
    expect(res.fieldMessage).toBeNull()
  })
})

describe('WorkflowError', () => {
  it('keeps the upstream message off `message` and exposes the path', () => {
    const err = new WorkflowError('BAD_REQUEST', 'invalid input', {
      upstreamMessage: UPSTREAM_PT,
      path: ['createWorkflow', 'nodes', 0],
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('WorkflowError')
    expect(err.message).toBe('invalid input')
    expect(err.upstreamMessage).toBe(UPSTREAM_PT)
    expect(err.path).toEqual(['createWorkflow', 'nodes', 0])
  })

  it('defaults upstreamMessage to null', () => {
    expect(new WorkflowError('NOT_FOUND', 'gone').upstreamMessage).toBeNull()
  })
})

describe('toClassification', () => {
  it('passes through the four documented classifications', () => {
    for (const c of [
      'BAD_REQUEST',
      'NOT_FOUND',
      'CONFLICT',
      'INTERNAL_ERROR',
    ] as const) {
      expect(toClassification(c)).toBe(c)
    }
  })

  it('treats an unknown or non-string classification as INTERNAL_ERROR', () => {
    // Conservative branch: generic copy and no raw message for anything the
    // service starts sending that we do not know about yet.
    expect(toClassification('VALIDATION')).toBe('INTERNAL_ERROR')
    expect(toClassification(undefined)).toBe('INTERNAL_ERROR')
    expect(toClassification(42)).toBe('INTERNAL_ERROR')
  })

  it('does not let a client-only classification in from the wire', () => {
    // NETWORK/NOT_CONFIGURED are ours; the server must never be able to claim
    // them and, say, suppress a real failure.
    expect(toClassification('NETWORK')).toBe('INTERNAL_ERROR')
    expect(toClassification('NOT_CONFIGURED')).toBe('INTERNAL_ERROR')
  })
})

describe('toWorkflowError', () => {
  it('returns a WorkflowError unchanged', () => {
    const err = new WorkflowError('CONFLICT', 'race')
    expect(toWorkflowError(err)).toBe(err)
  })

  it('wraps a raw Error without carrying its message forward', () => {
    // A stray Error may hold the internal service URL; it must not become a
    // displayable fieldMessage.
    const wrapped = toWorkflowError(
      new Error('connect ECONNREFUSED 10.0.0.7:8080'),
    )
    expect(wrapped.classification).toBe('INTERNAL_ERROR')
    expect(wrapped.upstreamMessage).toBeNull()
    expect(wrapped.message).not.toContain('10.0.0.7')
    expect(workflowErrorResponse(wrapped).fieldMessage).toBeNull()
  })

  it('wraps a non-Error throw', () => {
    expect(toWorkflowError('boom').classification).toBe('INTERNAL_ERROR')
  })
})
