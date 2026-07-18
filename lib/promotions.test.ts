import { describe, it, expect } from 'vitest'
import type { Promotion } from '@/lib/api/types'
import {
  bestPromotion,
  isPromotionLive,
  nextPromotionNudge,
  promotionDiscount,
  promotionStatus,
} from './promotions'

const NOW = new Date('2026-07-17T12:00:00.000Z')

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'promo1',
    businessUnitId: 'bu-1',
    name: 'Lunch deal',
    discountType: 'PERCENTAGE',
    discountValue: '10.00',
    minOrderValue: '30.00',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-31T23:59:59.000Z',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

describe('promotionStatus', () => {
  it('is active inside the window when the flag is on', () => {
    expect(promotionStatus(promo(), NOW)).toBe('active')
  })

  it('is inactive whenever the flag is off, even inside the window', () => {
    expect(promotionStatus(promo({ isActive: false }), NOW)).toBe('inactive')
  })

  it('is scheduled before the start and expired after the end', () => {
    expect(
      promotionStatus(promo({ startDate: '2026-08-01T00:00:00.000Z' }), NOW),
    ).toBe('scheduled')
    expect(
      promotionStatus(promo({ endDate: '2026-07-01T00:00:00.000Z' }), NOW),
    ).toBe('expired')
  })

  it('treats unparseable dates as inactive', () => {
    expect(promotionStatus(promo({ startDate: 'nope' }), NOW)).toBe('inactive')
  })

  it('isPromotionLive mirrors the active status', () => {
    expect(isPromotionLive(promo(), NOW)).toBe(true)
    expect(isPromotionLive(promo({ isActive: false }), NOW)).toBe(false)
  })
})

describe('promotionDiscount', () => {
  it('is zero below the minimum order value', () => {
    expect(promotionDiscount(promo(), '29.99').toFixed(2)).toBe('0.00')
  })

  it('computes a percentage of the subtotal, rounded to cents', () => {
    expect(promotionDiscount(promo(), '51.80').toFixed(2)).toBe('5.18')
    // 10% of 33.33 → 3.333 → rounds half-up to 3.33.
    expect(promotionDiscount(promo(), '33.33').toFixed(2)).toBe('3.33')
  })

  it('caps a fixed discount at the subtotal', () => {
    const fixed = promo({
      discountType: 'FIXED_AMOUNT',
      discountValue: '15.00',
      minOrderValue: '0',
    })
    expect(promotionDiscount(fixed, '40.00').toFixed(2)).toBe('15.00')
    expect(promotionDiscount(fixed, '10.00').toFixed(2)).toBe('10.00')
  })
})

describe('bestPromotion', () => {
  it('picks the live promotion with the largest discount', () => {
    const small = promo({ id: 'a', discountValue: '5.00' })
    const big = promo({
      id: 'b',
      discountType: 'FIXED_AMOUNT',
      discountValue: '12.00',
    })
    const best = bestPromotion([small, big], '100.00', NOW)
    expect(best?.promotion.id).toBe('b')
    expect(best?.discount.toFixed(2)).toBe('12.00')
  })

  it('ignores promotions that are not live or not reached', () => {
    const inactive = promo({ id: 'a', isActive: false })
    const tooHigh = promo({ id: 'b', minOrderValue: '999.00' })
    expect(bestPromotion([inactive, tooHigh], '50.00', NOW)).toBeNull()
  })
})

describe('nextPromotionNudge', () => {
  it('returns the smallest gap to a live promotion minimum', () => {
    const near = promo({ id: 'a', minOrderValue: '60.00' })
    const far = promo({ id: 'b', minOrderValue: '120.00' })
    const nudge = nextPromotionNudge([far, near], '51.80', NOW)
    expect(nudge?.promotion.id).toBe('a')
    expect(nudge?.missing.toFixed(2)).toBe('8.20')
  })

  it('returns null when the subtotal already qualifies', () => {
    expect(nextPromotionNudge([promo()], '51.80', NOW)).toBeNull()
  })
})
