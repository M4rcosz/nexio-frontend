import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TENANT_ID,
  TENANTS,
  getTenantById,
  toBranding,
  tenantThemeVars,
  localized,
} from './config'

describe('getTenantById', () => {
  it('returns the matching tenant', () => {
    expect(getTenantById('sertao').id).toBe('sertao')
  })

  it('falls back to the default tenant for unknown/missing ids', () => {
    expect(getTenantById('does-not-exist').id).toBe(DEFAULT_TENANT_ID)
    expect(getTenantById(null).id).toBe(DEFAULT_TENANT_ID)
    expect(getTenantById().id).toBe(DEFAULT_TENANT_ID)
  })
})

describe('toBranding', () => {
  it('projects only the client-safe branding fields (drops theme)', () => {
    const branding = toBranding(TENANTS.nexio)
    expect(branding).toEqual({
      id: 'nexio',
      name: 'Nexio',
      shortName: 'Nexio',
      logoMark: 'N',
      logoUrl: null,
      tagline: TENANTS.nexio.tagline,
    })
    expect(branding).not.toHaveProperty('theme')
    expect(branding).not.toHaveProperty('description')
  })
})

describe('tenantThemeVars', () => {
  it('emits a CSS-variable map for every brand and accent stop', () => {
    const vars = tenantThemeVars(TENANTS.nexio)
    expect(vars['--brand-500']).toBe(TENANTS.nexio.theme.brand['500'])
    expect(vars['--accent-500']).toBe(TENANTS.nexio.theme.accent['500'])
    // 11 stops each for brand + accent = 22 variables.
    expect(Object.keys(vars)).toHaveLength(22)
  })
})

describe('localized', () => {
  const text = { en: 'Hello', 'pt-BR': 'Olá' }

  it('returns the requested locale when present', () => {
    expect(localized(text, 'pt-BR')).toBe('Olá')
  })

  it('falls back to English, then to the first value, then to empty string', () => {
    expect(localized(text, 'fr')).toBe('Hello')
    expect(localized({ 'pt-BR': 'Olá' }, 'fr')).toBe('Olá')
    expect(localized({}, 'fr')).toBe('')
  })
})
