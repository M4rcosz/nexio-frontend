// Pure promotion-eligibility helpers, shared by the customer flow (banner,
// checkout estimate), the order mocks and the admin status badge.
//
// Business rules (see docs/frontend-api-reference.md § Promotions):
//   - one promotion per order, the backend applies it before loyalty points;
//   - a promotion counts when isActive AND now is inside [startDate, endDate]
//     AND the items subtotal reaches minOrderValue ("0" = no minimum).
import Big from 'big.js'
import { asMoney, type Money } from '@/lib/money'
import type { Promotion } from '@/lib/api/types'

export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive'

/**
 * Effective status of a promotion at `now`. `isActive` is the kill switch;
 * within it the date window decides scheduled/active/expired.
 */
export function promotionStatus(
  promotion: Promotion,
  now: Date = new Date(),
): PromotionStatus {
  if (!promotion.isActive) return 'inactive'
  const start = new Date(promotion.startDate)
  const end = new Date(promotion.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'inactive'
  }
  if (now < start) return 'scheduled'
  if (now > end) return 'expired'
  return 'active'
}

/** True when the promotion is running right now (regardless of order value). */
export function isPromotionLive(
  promotion: Promotion,
  now: Date = new Date(),
): boolean {
  return promotionStatus(promotion, now) === 'active'
}

/**
 * Discount a live promotion grants on `subtotal`, rounded to 2 decimal
 * places and never above the subtotal. Returns 0 when the subtotal is below
 * the promotion's minimum — liveness is the caller's concern.
 */
export function promotionDiscount(
  promotion: Promotion,
  subtotal: Money | string,
): Money {
  const sub = asMoney(subtotal)
  if (sub.lt(asMoney(promotion.minOrderValue))) return asMoney(0)
  const raw =
    promotion.discountType === 'PERCENTAGE'
      ? sub.times(asMoney(promotion.discountValue)).div(100)
      : asMoney(promotion.discountValue)
  const rounded = raw.round(2, Big.roundHalfUp)
  return rounded.gt(sub) ? sub : rounded
}

export type AppliedPromotion = {
  promotion: Promotion
  discount: Money
}

/**
 * The single promotion an order of `subtotal` would get: the live promotion
 * with the largest discount (first wins ties). Null when none applies.
 */
export function bestPromotion(
  promotions: Promotion[],
  subtotal: Money | string,
  now: Date = new Date(),
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null
  for (const promotion of promotions) {
    if (!isPromotionLive(promotion, now)) continue
    const discount = promotionDiscount(promotion, subtotal)
    if (discount.lte(0)) continue
    if (!best || discount.gt(best.discount)) best = { promotion, discount }
  }
  return best
}

export type PromotionNudge = {
  promotion: Promotion
  /** How much the subtotal is short of the promotion's minimum. */
  missing: Money
}

/**
 * The cheapest way to unlock a discount: among live promotions whose minimum
 * the subtotal has not reached yet, the one with the smallest gap. Null when
 * nothing is unlockable (or something already applies at this subtotal).
 */
export function nextPromotionNudge(
  promotions: Promotion[],
  subtotal: Money | string,
  now: Date = new Date(),
): PromotionNudge | null {
  const sub = asMoney(subtotal)
  let best: PromotionNudge | null = null
  for (const promotion of promotions) {
    if (!isPromotionLive(promotion, now)) continue
    const min = asMoney(promotion.minOrderValue)
    if (sub.gte(min)) continue
    const missing = min.minus(sub)
    if (!best || missing.lt(best.missing)) best = { promotion, missing }
  }
  return best
}
