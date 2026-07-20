import { describe, it, expect } from 'vitest'
import {
  getChannelPolicy,
  requiresStaffActor,
  allowsCustomerId,
  nameRejected,
  nameRequired,
  customerFields,
} from './channelPolicy'

describe('getChannelPolicy', () => {
  it('encodes the doc §3 table for APP/WEB (JWT identity, name rejected)', () => {
    for (const channel of ['APP', 'WEB'] as const) {
      const p = getChannelPolicy(channel)
      expect(p.requiresStaffActor).toBe(false)
      expect(p.allowsCustomerId).toBe(false)
      expect(p.nameRejected).toBe(true)
      expect(p.nameAlwaysRequired).toBe(false)
    }
  })

  it('encodes TOTEM (no staff, no id, name always required)', () => {
    const p = getChannelPolicy('TOTEM')
    expect(p.requiresStaffActor).toBe(false)
    expect(p.allowsCustomerId).toBe(false)
    expect(p.nameAlwaysRequired).toBe(true)
    expect(p.nameRejected).toBe(false)
  })

  it('encodes COUNTER/PICKUP (staff, optional id, name if walk-in)', () => {
    for (const channel of ['COUNTER', 'PICKUP'] as const) {
      const p = getChannelPolicy(channel)
      expect(p.requiresStaffActor).toBe(true)
      expect(p.allowsCustomerId).toBe(true)
      expect(p.nameAlwaysRequired).toBe(false)
      expect(p.nameRejected).toBe(false)
    }
  })
})

describe('helpers', () => {
  it('requiresStaffActor / allowsCustomerId / nameRejected mirror the table', () => {
    expect(requiresStaffActor('COUNTER')).toBe(true)
    expect(requiresStaffActor('WEB')).toBe(false)
    expect(allowsCustomerId('PICKUP')).toBe(true)
    expect(allowsCustomerId('TOTEM')).toBe(false)
    expect(nameRejected('APP')).toBe(true)
    expect(nameRejected('COUNTER')).toBe(false)
  })
})

describe('nameRequired', () => {
  it('is always true for TOTEM', () => {
    expect(nameRequired('TOTEM', false)).toBe(true)
    expect(nameRequired('TOTEM', true)).toBe(true)
  })

  it('is never true for APP/WEB', () => {
    expect(nameRequired('APP', false)).toBe(false)
    expect(nameRequired('WEB', false)).toBe(false)
  })

  it('is true for a COUNTER/PICKUP walk-in and false when a customerId exists', () => {
    expect(nameRequired('COUNTER', false)).toBe(true)
    expect(nameRequired('COUNTER', true)).toBe(false)
    expect(nameRequired('PICKUP', false)).toBe(true)
    expect(nameRequired('PICKUP', true)).toBe(false)
  })
})

describe('customerFields', () => {
  it('never emits both customerId and customerName', () => {
    expect(customerFields({ kind: 'jwt' })).toEqual({})
    expect(customerFields({ kind: 'account', customerId: 'c1' })).toEqual({
      customerId: 'c1',
    })
    expect(customerFields({ kind: 'name', customerName: 'Maria' })).toEqual({
      customerName: 'Maria',
    })
  })
})
