import { describe, it, expect } from 'vitest'
import type {
  BusinessUnit,
  Category,
  ProductResponseDto,
} from '@/lib/api/types'
import {
  buildCategoryPatch,
  buildBusinessUnitPatch,
  buildProductPatch,
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
    imageUrl: 'https://cdn.example.com/a.png',
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

  it('never clears description or imageUrl when emptied', () => {
    // Emptying these is a no-op (they cannot be cleared here), so nothing else
    // changed -> noChanges.
    expect(
      buildProductPatch(
        { ...base, description: '  ', imageUrl: '   ' },
        product,
      ),
    ).toEqual({ error: 'noChanges' })
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

  it('includes a new imageUrl', () => {
    expect(
      buildProductPatch(
        { ...base, imageUrl: 'https://cdn.example.com/b.png' },
        product,
      ),
    ).toEqual({ patch: { imageUrl: 'https://cdn.example.com/b.png' } })
  })

  it('treats whitespace-equal values as unchanged', () => {
    expect(
      buildProductPatch(
        {
          name: '  Burger ',
          description: ' Beef ',
          price: '25.00',
          categoryId: '11111111-1111-1111-1111-111111111111',
          imageUrl: 'https://cdn.example.com/a.png',
        },
        product,
      ),
    ).toEqual({ error: 'noChanges' })
  })
})
