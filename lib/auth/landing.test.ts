import { describe, it, expect } from 'vitest'
import { landingPathForRole } from './landing'

describe('landingPathForRole', () => {
  it('routes ADMIN and MANAGER to the admin area', () => {
    expect(landingPathForRole('ADMIN')).toBe('/admin')
    expect(landingPathForRole('MANAGER')).toBe('/admin')
  })

  it('routes ATTENDANT to the POS order-entry surface', () => {
    expect(landingPathForRole('ATTENDANT')).toBe('/pos')
  })

  it('routes staff without a dashboard and customers to home', () => {
    expect(landingPathForRole('KITCHEN')).toBe('/')
    expect(landingPathForRole('CUSTOMER')).toBe('/')
  })

  it('falls back to home for missing/unknown roles', () => {
    expect(landingPathForRole()).toBe('/')
    expect(landingPathForRole(null)).toBe('/')
    expect(landingPathForRole('WHATEVER')).toBe('/')
  })
})
