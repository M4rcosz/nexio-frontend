// Mock fallback for the `/business-units` endpoints.
import type {
  BusinessUnit,
  CreateBusinessUnitRequest,
  Paginated,
  PublicBusinessUnit,
} from '@/lib/api/types'
import { mockDelay } from './_delay'

const NOW = new Date().toISOString()

// Brand name and city/neighborhood names are kept as-is (proper nouns).
// cnpj follows the API contract: 14 digits, no mask.
export const MOCK_BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: 'bu_recife_boavista',
    name: 'Nexio Recife — Boa Vista',
    cnpj: '12345678000190',
    address: 'Rua da Aurora, 1042, Boa Vista',
    city: 'Recife',
    phone: '(81) 3030-1010',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bu_olinda_carmo',
    name: 'Nexio Olinda — Carmo',
    cnpj: '12345678000271',
    address: 'Praça do Carmo, 88, Carmo',
    city: 'Olinda',
    phone: '(81) 3030-1011',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bu_jpa_tambau',
    name: 'Nexio João Pessoa — Tambaú',
    cnpj: '12345678000352',
    address: 'Av. Cabo Branco, 2400, Tambaú',
    city: 'João Pessoa',
    phone: '(83) 3030-1012',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bu_natal_ponta_negra',
    name: 'Nexio Natal — Ponta Negra',
    cnpj: '12345678000433',
    address: 'Av. Engenheiro Roberto Freire, 5500',
    city: 'Natal',
    phone: '(84) 3030-1013',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

/** Projects the full record onto the public view (mirrors the backend). */
function toPublic(u: BusinessUnit): PublicBusinessUnit {
  return {
    id: u.id,
    name: u.name,
    address: u.address,
    city: u.city,
    phone: u.phone,
  }
}

export type PublicBusinessUnitFilters = {
  search?: string
  city?: string
}

export async function listBusinessUnitsMock(
  filters: PublicBusinessUnitFilters = {},
): Promise<Paginated<PublicBusinessUnit>> {
  await mockDelay()
  // Public view is active-only, mirroring the backend.
  let data = MOCK_BUSINESS_UNITS.filter((u) => u.isActive)
  if (filters.city) {
    const city = filters.city.toLowerCase()
    data = data.filter((u) => u.city.toLowerCase().includes(city))
  }
  if (filters.search) {
    const term = filters.search.toLowerCase()
    data = data.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.city.toLowerCase().includes(term),
    )
  }
  return {
    data: data.map(toPublic),
    meta: { limit: 20, nextCursor: null, hasMore: false },
  }
}

export async function getBusinessUnitMock(
  id: string,
): Promise<PublicBusinessUnit | null> {
  await mockDelay()
  const unit = MOCK_BUSINESS_UNITS.find((u) => u.id === id && u.isActive)
  return unit ? toPublic(unit) : null
}

export type InternalBusinessUnitFilters = {
  search?: string
  city?: string
  /** When set, restricts the listing to active/inactive units. */
  isActive?: boolean
}

/**
 * Full listing for the admin unit selector — includes inactive units, unlike
 * {@link listBusinessUnitsMock} (which is the public, active-only view).
 */
export async function listBusinessUnitsInternalMock(
  filters: InternalBusinessUnitFilters = {},
): Promise<Paginated<BusinessUnit>> {
  await mockDelay()
  let data = [...MOCK_BUSINESS_UNITS]
  if (typeof filters.isActive === 'boolean') {
    data = data.filter((u) => u.isActive === filters.isActive)
  }
  if (filters.city) {
    const city = filters.city.toLowerCase()
    data = data.filter((u) => u.city.toLowerCase().includes(city))
  }
  if (filters.search) {
    const term = filters.search.toLowerCase()
    data = data.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.city.toLowerCase().includes(term) ||
        u.cnpj.toLowerCase().includes(term),
    )
  }
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}

export async function getBusinessUnitInternalMock(
  id: string,
): Promise<BusinessUnit | null> {
  await mockDelay()
  const unit = MOCK_BUSINESS_UNITS.find((u) => u.id === id)
  return unit ? { ...unit } : null
}

export async function createBusinessUnitMock(
  input: CreateBusinessUnitRequest,
): Promise<BusinessUnit> {
  await mockDelay()
  if (MOCK_BUSINESS_UNITS.some((u) => u.cnpj === input.cnpj || u.phone === input.phone)) {
    throw Object.assign(new Error('cnpj or phone already in use.'), {
      code: 'already_exists',
    })
  }
  const now = new Date().toISOString()
  const unit: BusinessUnit = {
    id: `bu_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    cnpj: input.cnpj,
    address: input.address,
    city: input.city,
    phone: input.phone,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  MOCK_BUSINESS_UNITS.push(unit)
  return { ...unit }
}

export async function setBusinessUnitActiveMock(
  id: string,
  isActive: boolean,
): Promise<BusinessUnit | null> {
  await mockDelay()
  const unit = MOCK_BUSINESS_UNITS.find((u) => u.id === id)
  if (!unit) return null
  unit.isActive = isActive
  unit.updatedAt = new Date().toISOString()
  return { ...unit }
}
