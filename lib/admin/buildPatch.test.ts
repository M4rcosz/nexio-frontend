import { describe, it, expect } from 'vitest'
import type {
  BusinessUnit,
  Category,
  ProductResponseDto,
  User,
} from '@/lib/api/types'
import {
  buildCategoryPatch,
  buildBusinessUnitPatch,
  buildProductPatch,
  buildUserPatch,
} from './buildPatch'

const category: Category = {
  id: 'c1',
  name: 'Drinks',
  description: 'Cold ones',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('buildCategoryPatch', () => {
  it('returns noChanges when nothing changed', () => {
    const res = buildCategoryPatch(
      { name: 'Drinks', description: 'Cold ones', isActive: true },
      category,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })

  it('trims and includes only the changed name', () => {
    const res = buildCategoryPatch(
      { name: '  Beverages  ', description: 'Cold ones', isActive: true },
      category,
    )
    expect(res).toEqual({ patch: { name: 'Beverages' } })
  })

  it('treats whitespace-equal values as unchanged', () => {
    const res = buildCategoryPatch(
      { name: '  Drinks  ', description: '  Cold ones  ', isActive: true },
      category,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })

  it('rejects a name shorter than 2 chars', () => {
    const res = buildCategoryPatch(
      { name: 'D', description: 'Cold ones', isActive: true },
      category,
    )
    expect(res).toEqual({ error: 'invalidName' })
  })

  it('errors when clearing an existing description', () => {
    const res = buildCategoryPatch(
      { name: 'Drinks', description: '   ', isActive: true },
      category,
    )
    expect(res).toEqual({ error: 'descriptionCannotBeCleared' })
  })

  it('allows adding a description when there was none', () => {
    const res = buildCategoryPatch(
      { name: 'Snacks', description: 'Salty', isActive: true },
      { ...category, name: 'Snacks', description: null },
    )
    expect(res).toEqual({ patch: { description: 'Salty' } })
  })

  it('includes the isActive toggle when flipped', () => {
    const res = buildCategoryPatch(
      { name: 'Drinks', description: 'Cold ones', isActive: false },
      category,
    )
    expect(res).toEqual({ patch: { isActive: false } })
  })
})

const unit: BusinessUnit = {
  id: 'bu1',
  name: 'Central',
  cnpj: '12345678000199',
  address: 'Main St 100',
  city: 'São Paulo',
  phone: '11999998888',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('buildBusinessUnitPatch', () => {
  const base = {
    name: 'Central',
    address: 'Main St 100',
    city: 'São Paulo',
    phone: '11999998888',
  }

  it('returns noChanges when identical', () => {
    expect(buildBusinessUnitPatch(base, unit)).toEqual({ error: 'noChanges' })
  })

  it('includes only changed, trimmed fields', () => {
    const res = buildBusinessUnitPatch(
      { ...base, name: '  Downtown  ', city: 'Rio' },
      unit,
    )
    expect(res).toEqual({ patch: { name: 'Downtown', city: 'Rio' } })
  })

  it('validates each field length', () => {
    expect(buildBusinessUnitPatch({ ...base, name: 'X' }, unit)).toEqual({
      error: 'invalidName',
    })
    expect(buildBusinessUnitPatch({ ...base, address: 'X' }, unit)).toEqual({
      error: 'invalidAddress',
    })
    expect(buildBusinessUnitPatch({ ...base, city: 'X' }, unit)).toEqual({
      error: 'invalidCity',
    })
    expect(buildBusinessUnitPatch({ ...base, phone: 'ab' }, unit)).toEqual({
      error: 'invalidPhone',
    })
  })

  it('treats whitespace-equal values as unchanged', () => {
    const res = buildBusinessUnitPatch(
      {
        name: '  Central  ',
        address: '  Main St 100 ',
        city: ' São Paulo ',
        phone: ' 11999998888 ',
      },
      unit,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })
})

const product: ProductResponseDto = {
  id: 'p1',
  name: 'Burger',
  description: 'Beef',
  price: '25.00',
  isActive: true,
  categoryId: '11111111-1111-1111-1111-111111111111',
  imageUrl: 'https://cdn.example.com/a.png',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('buildProductPatch', () => {
  const base = {
    name: 'Burger',
    description: 'Beef',
    price: '25.00',
    categoryId: '11111111-1111-1111-1111-111111111111',
  }

  it('returns noChanges when identical', () => {
    expect(buildProductPatch(base, product)).toEqual({ error: 'noChanges' })
  })

  it('includes only the changed name (trimmed)', () => {
    expect(
      buildProductPatch({ ...base, name: '  Cheeseburger ' }, product),
    ).toEqual({ patch: { name: 'Cheeseburger' } })
  })

  it('rejects an invalid price', () => {
    expect(buildProductPatch({ ...base, price: '0' }, product)).toEqual({
      error: 'invalidMoney',
    })
    expect(buildProductPatch({ ...base, price: 'abc' }, product)).toEqual({
      error: 'invalidMoney',
    })
  })

  it('accepts a valid new price', () => {
    expect(buildProductPatch({ ...base, price: '30.50' }, product)).toEqual({
      patch: { price: '30.50' },
    })
  })

  it('rejects a non-UUID category', () => {
    expect(buildProductPatch({ ...base, categoryId: 'nope' }, product)).toEqual(
      {
        error: 'invalidCategory',
      },
    )
  })

  it('never clears the description when emptied', () => {
    // Emptying it is a no-op (it cannot be cleared here), so nothing else
    // changed -> noChanges.
    expect(buildProductPatch({ ...base, description: '  ' }, product)).toEqual({
      error: 'noChanges',
    })
  })

  it('adds a description that changed', () => {
    expect(
      buildProductPatch({ ...base, description: 'Double beef' }, product),
    ).toEqual({ patch: { description: 'Double beef' } })
  })

  it('includes a new valid categoryId', () => {
    expect(
      buildProductPatch(
        { ...base, categoryId: '22222222-2222-2222-2222-222222222222' },
        product,
      ),
    ).toEqual({ patch: { categoryId: '22222222-2222-2222-2222-222222222222' } })
  })

  it('never touches the image — it is not a field of this form', () => {
    // The image is attached with the upload/confirm pair and cleared with an
    // explicit `imageUrl: null` patch, so it must never ride along here.
    expect(
      buildProductPatch({ ...base, name: 'Cheeseburger' }, product),
    ).toEqual({ patch: { name: 'Cheeseburger' } })
  })

  it('treats whitespace-equal values as unchanged', () => {
    expect(
      buildProductPatch(
        {
          name: '  Burger ',
          description: ' Beef ',
          price: '25.00',
          categoryId: '11111111-1111-1111-1111-111111111111',
        },
        product,
      ),
    ).toEqual({ error: 'noChanges' })
  })
})

const staff: User = {
  id: 'u1',
  username: 'bob.staff',
  name: 'Bob Staff',
  email: 'bob@example.com',
  phone: null,
  role: 'ATTENDANT',
  businessUnitIds: ['bu-1'],
  isActive: true,
}

const staffForm = {
  name: 'Bob Staff',
  email: 'bob@example.com',
  phone: '',
  role: 'ATTENDANT' as const,
  businessUnitIds: ['bu-1'],
}

describe('buildUserPatch', () => {
  it('returns noChanges when nothing changed', () => {
    expect(buildUserPatch(staffForm, staff, true)).toEqual({
      error: 'noChanges',
    })
  })

  it('sends only the changed units', () => {
    const res = buildUserPatch(
      { ...staffForm, businessUnitIds: ['bu-1', 'bu-2'] },
      staff,
      true,
    )
    expect(res).toEqual({ patch: { businessUnitIds: ['bu-1', 'bu-2'] } })
  })

  it('treats a reordered unit set as unchanged', () => {
    const user = { ...staff, businessUnitIds: ['bu-1', 'bu-2'] }
    const res = buildUserPatch(
      { ...staffForm, businessUnitIds: ['bu-2', 'bu-1'] },
      user,
      true,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })

  // Mixing `||` on one side with `??` on the other made a stored empty phone
  // read as changed, which put `phone` in the patch and 501'd an untouched form.
  it('does not treat a stored empty phone as a change', () => {
    const user = { ...staff, phone: '' }
    expect(buildUserPatch(staffForm, user, true)).toEqual({
      error: 'noChanges',
    })
  })

  it('does not treat a stored null email as a change', () => {
    const user = { ...staff, email: null }
    const res = buildUserPatch({ ...staffForm, email: '' }, user, true)
    expect(res).toEqual({ error: 'noChanges' })
  })

  // The picker is hidden at ADMIN, so a stale unit binding on the stored row is
  // not something the actor can see or act on — diffing it would emit an empty
  // unit set for a form nobody touched.
  it('ignores stale units on an ADMIN row when the role is unchanged', () => {
    const admin = {
      ...staff,
      role: 'ADMIN' as const,
      businessUnitIds: ['bu-1'],
    }
    const res = buildUserPatch(
      { ...staffForm, role: 'ADMIN' as const, businessUnitIds: [] },
      admin,
      true,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })

  it('clears the units when the role is actually changing to ADMIN', () => {
    const res = buildUserPatch(
      { ...staffForm, role: 'ADMIN' as const },
      staff,
      true,
    )
    expect(res).toEqual({ patch: { role: 'ADMIN', businessUnitIds: [] } })
  })

  // A MANAGER's units are discarded server-side, so diffing them could only
  // produce an error naming units the actor is looking at.
  it('omits units entirely when the actor may not edit them', () => {
    const res = buildUserPatch(
      { ...staffForm, businessUnitIds: ['bu-1', 'bu-2'] },
      staff,
      false,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })

  it('trims profile fields before comparing', () => {
    const res = buildUserPatch(
      { ...staffForm, name: '  Bob Staff  ' },
      staff,
      true,
    )
    expect(res).toEqual({ error: 'noChanges' })
  })
})
