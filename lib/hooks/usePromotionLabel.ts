'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { PromotionOffer } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'

/** Human copy for what a promotion grants, e.g. "10% off orders over R$30". */
export function useDiscountLabel(): (promotion: PromotionOffer) => string {
  const t = useTranslations('menu.promotions')
  const locale = useLocale()
  return (promotion: PromotionOffer) => {
    const hasMin = Number(promotion.minOrderValue) > 0
    const min = formatMoney(promotion.minOrderValue, locale)
    if (promotion.discountType === 'PERCENTAGE') {
      const value = new Intl.NumberFormat(locale).format(
        Number(promotion.discountValue),
      )
      return hasMin
        ? t('percentOverMin', { value, min })
        : t('percentAll', { value })
    }
    const value = formatMoney(promotion.discountValue, locale)
    return hasMin ? t('fixedOverMin', { value, min }) : t('fixedAll', { value })
  }
}
