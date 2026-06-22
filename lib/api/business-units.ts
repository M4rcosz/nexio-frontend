// [stub] backend does not implement /business-units yet — always uses mock.
import type { BusinessUnit, Paginated } from './types'
import {
  getBusinessUnit as getBusinessUnitMock,
  listBusinessUnits as listBusinessUnitsMock,
} from './mocks/business-units'

export async function listBusinessUnits(): Promise<Paginated<BusinessUnit>> {
  return listBusinessUnitsMock()
}

export async function getBusinessUnit(
  id: string,
): Promise<BusinessUnit | null> {
  return getBusinessUnitMock(id)
}
