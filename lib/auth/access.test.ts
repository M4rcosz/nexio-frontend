import { describe, it, expect } from 'vitest'
import type { Role } from '@/lib/api/types'
import {
  canAccessUnit,
  getManageableRoles,
  canManageRole,
  type AdminContext,
  type AdminRole,
} from './access'

function ctx(overrides: Partial<AdminContext> = {}): AdminContext {
  return {
    userId: 'u1',
    role: 'MANAGER',
    scopedBusinessUnitIds: ['bu-1'],
    scopedBusinessUnitId: 'bu-1',
    manageableRoles: ['ATTENDANT', 'KITCHEN'],
    ...overrides,
  }
}

describe('canAccessUnit', () => {
  it('lets ADMIN (unscoped, null ids) access any unit', () => {
    const admin = ctx({ role: 'ADMIN', scopedBusinessUnitIds: null })
    expect(canAccessUnit(admin, 'anything')).toBe(true)
  })

  it('lets a MANAGER access a unit within scope', () => {
    expect(
      canAccessUnit(ctx({ scopedBusinessUnitIds: ['bu-1'] }), 'bu-1'),
    ).toBe(true)
  })

  it('denies a MANAGER a unit outside scope', () => {
    expect(
      canAccessUnit(ctx({ scopedBusinessUnitIds: ['bu-1'] }), 'bu-2'),
    ).toBe(false)
  })

  it('denies a MANAGER with an empty scope', () => {
    expect(canAccessUnit(ctx({ scopedBusinessUnitIds: [] }), 'bu-1')).toBe(
      false,
    )
  })
})

describe('getManageableRoles', () => {
  it('returns the full staff hierarchy for ADMIN', () => {
    expect(getManageableRoles('ADMIN')).toEqual([
      'ADMIN',
      'MANAGER',
      'ATTENDANT',
      'KITCHEN',
    ])
  })

  it('returns only floor roles for MANAGER', () => {
    expect(getManageableRoles('MANAGER')).toEqual(['ATTENDANT', 'KITCHEN'])
  })
})

describe('canManageRole', () => {
  const cases: Array<[AdminRole, Role, boolean]> = [
    ['ADMIN', 'ADMIN', true],
    ['ADMIN', 'MANAGER', true],
    ['ADMIN', 'ATTENDANT', true],
    ['ADMIN', 'KITCHEN', true],
    ['ADMIN', 'CUSTOMER', false],
    ['MANAGER', 'ADMIN', false],
    ['MANAGER', 'MANAGER', false],
    ['MANAGER', 'ATTENDANT', true],
    ['MANAGER', 'KITCHEN', true],
    ['MANAGER', 'CUSTOMER', false],
  ]

  it.each(cases)('%s managing %s -> %s', (actor, target, expected) => {
    expect(canManageRole(actor, target)).toBe(expected)
  })
})
