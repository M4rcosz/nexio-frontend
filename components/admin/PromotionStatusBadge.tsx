'use client'

import { useTranslations } from 'next-intl'
import { promotionStatus, type PromotionStatus } from '@/lib/promotions'
import type { Promotion } from '@/lib/api/types'

const STYLES: Record<PromotionStatus, string> = {
  active: 'bg-forest-500/10 text-forest-700 dark:text-forest-300',
  scheduled: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
  expired: 'bg-accent-500/10 text-accent-700 dark:text-accent-300',
  inactive: 'bg-surface-2 text-fg-subtle',
}

/**
 * Effective promotion status: the `isActive` flag combined with the date
 * window, so an enabled-but-expired campaign is not presented as running.
 */
export function PromotionStatusBadge({ promotion }: { promotion: Promotion }) {
  const t = useTranslations('admin.promotions')
  const status = promotionStatus(promotion)
  const label = {
    active: t('statusActive'),
    scheduled: t('statusScheduled'),
    expired: t('statusExpired'),
    inactive: t('statusInactive'),
  }[status]
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {label}
    </span>
  )
}
