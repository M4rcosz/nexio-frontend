import { describe, it, expect } from 'vitest'
import type { OrderStatus } from '@/lib/api/types'
import { VALID_TRANSITIONS, forwardStatuses, canCancel } from './statusMachine'

describe('VALID_TRANSITIONS', () => {
  it('matches the backend state machine exactly (doc §9)', () => {
    expect(VALID_TRANSITIONS).toEqual({
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    })
  })

  it('has terminal DELIVERED and CANCELLED states', () => {
    expect(VALID_TRANSITIONS.DELIVERED).toEqual([])
    expect(VALID_TRANSITIONS.CANCELLED).toEqual([])
  })

  it('never lists a status as a transition to itself', () => {
    for (const [status, targets] of Object.entries(VALID_TRANSITIONS)) {
      expect(targets).not.toContain(status as OrderStatus)
    }
  })
})

describe('forwardStatuses', () => {
  it('filters CANCELLED out of every step', () => {
    expect(forwardStatuses('PENDING')).toEqual(['CONFIRMED'])
    expect(forwardStatuses('CONFIRMED')).toEqual(['PREPARING'])
    expect(forwardStatuses('PREPARING')).toEqual(['READY'])
    expect(forwardStatuses('READY')).toEqual(['DELIVERED'])
  })

  it('returns nothing for terminal states', () => {
    expect(forwardStatuses('DELIVERED')).toEqual([])
    expect(forwardStatuses('CANCELLED')).toEqual([])
  })
})

describe('canCancel', () => {
  it('lets staff cancel while PENDING or CONFIRMED', () => {
    expect(canCancel('PENDING', 'staff')).toBe(true)
    expect(canCancel('CONFIRMED', 'staff')).toBe(true)
    expect(canCancel('PREPARING', 'staff')).toBe(false)
    expect(canCancel('READY', 'staff')).toBe(false)
    expect(canCancel('DELIVERED', 'staff')).toBe(false)
    expect(canCancel('CANCELLED', 'staff')).toBe(false)
  })

  it('lets a customer cancel only while PENDING', () => {
    expect(canCancel('PENDING', 'customer')).toBe(true)
    expect(canCancel('CONFIRMED', 'customer')).toBe(false)
    expect(canCancel('PREPARING', 'customer')).toBe(false)
  })
})
