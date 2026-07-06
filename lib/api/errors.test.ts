import { describe, it, expect } from 'vitest'
import { ApiError, describeError } from './errors'

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

  it('returns the message for a plain Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('returns a fallback for a non-error value', () => {
    expect(describeError('nope')).toBe('Unknown error.')
  })
})
