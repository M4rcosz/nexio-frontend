'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Promotion } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { PromotionCard } from './PromotionCard'
import { PromotionStatusBadge } from './PromotionStatusBadge'
import { PromotionToggle } from './PromotionToggle'

export function PromotionList({ promotions }: { promotions: Promotion[] }) {
  const t = useTranslations('admin.promotions')
  const locale = useLocale()

  if (promotions.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🏷️
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  function discountLabel(p: Promotion): string {
    return p.discountType === 'PERCENTAGE'
      ? t('discountPercentage', { value: p.discountValue })
      : t('discountFixed', { value: formatMoney(p.discountValue, locale) })
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {promotions.map((p) => (
          <PromotionCard key={p.id} promotion={p} />
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                <th className="px-4 py-3 font-medium">{t('tableDiscount')}</th>
                <th className="px-4 py-3 font-medium">{t('tableMinOrder')}</th>
                <th className="px-4 py-3 font-medium">{t('tableWindow')}</th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-fg">{p.name}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {discountLabel(p)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {formatMoney(p.minOrderValue, locale)}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle">
                    {formatDateTime(p.startDate, locale)} —{' '}
                    {formatDateTime(p.endDate, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <PromotionStatusBadge promotion={p} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PromotionToggle
                      promotion={p}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    />
                    <Link
                      href={`/admin/promotions/${p.id}`}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    >
                      {t('actionEdit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
