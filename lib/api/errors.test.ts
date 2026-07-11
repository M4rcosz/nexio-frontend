import { describe, it, expect } from 'vitest'
import { ApiError, backendErrorStatus, describeError } from './errors'

describe('ApiError', () => {
  it('carries status, body and message', () => {
    const err = new ApiError(409, { code: 'name_taken' }, 'Conflict')
    expect(err.status).toBe(409)
    expect(err.body).toEqual({ code: 'name_taken' })
    expect(err.message).toBe('Conflict')
    expect(err.name).toBe('ApiError')
    expect(err).toBeInstanceOf(Error)
  })

  describe('fromUnknown', () => {
    it('returns the same instance when already an ApiError', () => {
      const err = new ApiError(500, null, 'boom')
      expect(ApiError.fromUnknown(err)).toBe(err)
    })

    it('wraps a plain Error with status 0', () => {
      const wrapped = ApiError.fromUnknown(new Error('network'))
      expect(wrapped).toBeInstanceOf(ApiError)
      expect(wrapped.status).toBe(0)
      expect(wrapped.message).toBe('network')
    })

    it('wraps a non-error value with a generic message', () => {
      const wrapped = ApiError.fromUnknown('weird')
      expect(wrapped.status).toBe(0)
      expect(wrapped.message).toBe('Unknown error')
    })
  })
})

describe('describeError', () => {
  it('maps 401 to a session-expired message', () => {
    expect(describeError(new ApiError(401, null, 'raw'))).toMatch(/session/i)
  })

  it('maps 403 to a permission message', () => {
    expect(describeError(new ApiError(403, null, 'raw'))).toMatch(/permission/i)
  })

  it('maps 404 to a not-found message', () => {
    expect(describeError(new ApiError(404, null, 'raw'))).toMatch(/not found/i)
  })

  it('maps >=500 to a generic server message without leaking the raw body', () => {
    const out = describeError(new ApiError(503, null, 'internal secret detail'))
    expect(out).toMatch(/server/i)
    expect(out).not.toContain('secret')
  })

  it('maps a generic 4xx to "Invalid request." without leaking the raw message', () => {
    const out = describeError(new ApiError(422, null, 'sql constraint xyz'))
    expect(out).toBe('Invalid request.')
    expect(out).not.toContain('sql')
  })

  it('stays generic for a plain Error, never echoing its message', () => {
    const out = describeError(new Error('boom'))
    expect(out).toMatch(/server/i)
    expect(out).not.toContain('boom')
  })

  it('returns a generic fallback for a non-error value', () => {
    expect(describeError('nope')).toMatch(/server/i)
  })

  it('never leaks the internal host from a network ApiError(0)', () => {
    const out = describeError(
      new ApiError(
        0,
        null,
        'Network failure: connect ECONNREFUSED 10.0.0.5:3000',
      ),
    )
    expect(out).toMatch(/server/i)
    expect(out).not.toContain('10.0.0.5')
    expect(out).not.toContain('ECONNREFUSED')
  })
})

describe('backendErrorStatus', () => {
  it('propagates an upstream 4xx as-is', () => {
    expect(backendErrorStatus(new ApiError(401, null, 'x'))).toBe(401)
    expect(backendErrorStatus(new ApiError(403, null, 'x'))).toBe(403)
    expect(backendErrorStatus(new ApiError(404, null, 'x'))).toBe(404)
    expect(backendErrorStatus(new ApiError(409, null, 'x'))).toBe(409)
    expect(backendErrorStatus(new ApiError(422, null, 'x'))).toBe(422)
  })

  it('collapses any upstream 5xx into 502', () => {
    expect(backendErrorStatus(new ApiError(500, null, 'x'))).toBe(502)
    expect(backendErrorStatus(new ApiError(503, null, 'x'))).toBe(502)
  })

  it('treats a network ApiError(0) and non-ApiError values as 502', () => {
    expect(backendErrorStatus(new ApiError(0, null, 'network'))).toBe(502)
    expect(backendErrorStatus(new Error('boom'))).toBe(502)
    expect(backendErrorStatus('weird')).toBe(502)
  })
})
