'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { Promotion } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { useDiscountLabel } from '@/lib/hooks/usePromotionLabel'

/**
 * Strip advertising the unit's live promotions on the menu page. Renders
 * nothing when the list is empty (customer/anonymous sessions may not be
 * allowed to read promotions at all — see `listActivePromotions`).
 */
export function PromotionBanner({ promotions }: { promotions: Promotion[] }) {
  const t = useTranslations('menu.promotions')
  const locale = useLocale()
  const discountLabel = useDiscountLabel()

  if (promotions.length === 0) return null

  return (
    <section
      aria-label={t('title')}
      className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 sm:p-5"
    >
      <p className="text-[11px] font-mono uppercase tracking-widest text-brand-600 dark:text-brand-400">
        <span aria-hidden="true">🏷️</span> {t('title')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {promotions.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-baseline gap-x-2 text-sm"
          >
            <span className="font-semibold text-fg">{p.name}</span>
            <span className="text-fg-muted">— {discountLabel(p)}</span>
            <span className="text-xs text-fg-subtle">
              {t('until', { date: formatDateTime(p.endDate, locale) })}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-subtle">{t('appliedNote')}</p>
    </section>
  )
}
