// TODO: backend not implemented yet — using mock data
import type { BusinessUnit, Paginated } from '@/lib/api/types'
import { mockDelay } from './_delay'

// Brand name and city/neighborhood names are kept as-is (proper nouns).
export const MOCK_BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: 'bu_recife_boavista',
    name: 'Raízes Recife — Boa Vista',
    cnpj: '12.345.678/0001-90',
    address: 'Rua da Aurora, 1042, Boa Vista',
    city: 'Recife',
    phone: '(81) 3030-1010',
    isActive: true,
  },
  {
    id: 'bu_olinda_carmo',
    name: 'Raízes Olinda — Carmo',
    cnpj: '12.345.678/0002-71',
    address: 'Praça do Carmo, 88, Carmo',
    city: 'Olinda',
    phone: '(81) 3030-1011',
    isActive: true,
  },
  {
    id: 'bu_jpa_tambau',
    name: 'Raízes João Pessoa — Tambaú',
    cnpj: '12.345.678/0003-52',
    address: 'Av. Cabo Branco, 2400, Tambaú',
    city: 'João Pessoa',
    phone: '(83) 3030-1012',
    isActive: true,
  },
  {
    id: 'bu_natal_ponta_negra',
    name: 'Raízes Natal — Ponta Negra',
    cnpj: '12.345.678/0004-33',
    address: 'Av. Engenheiro Roberto Freire, 5500',
    city: 'Natal',
    phone: '(84) 3030-1013',
    isActive: true,
  },
]

export async function listBusinessUnits(): Promise<Paginated<BusinessUnit>> {
  await mockDelay()
  return {
    data: MOCK_BUSINESS_UNITS.filter((u) => u.isActive),
    meta: { limit: 20, nextCursor: null, hasMore: false },
  }
}

export async function getBusinessUnit(id: string): Promise<BusinessUnit | null> {
  await mockDelay()
  return MOCK_BUSINESS_UNITS.find((u) => u.id === id) ?? null
}
