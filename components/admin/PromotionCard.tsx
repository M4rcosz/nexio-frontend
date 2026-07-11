'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Promotion } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'

/** Mobile-friendly variant of a PromotionList row — used below `md` screens. */
export function PromotionCard({ promotion }: { promotion: Promotion }) {
  const t = useTranslations('admin.promotions')
  const locale = useLocale()

  const discountLabel =
    promotion.discountType === 'PERCENTAGE'
      ? t('discountPercentage', { value: promotion.discountValue })
      : t('discountFixed', {
          value: formatMoney(promotion.discountValue, locale),
        })

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold text-fg">
          {promotion.name}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            promotion.isActive
              ? 'bg-forest-500/10 text-forest-700 dark:text-forest-300'
              : 'bg-surface-2 text-fg-subtle'
          }`}
        >
          {promotion.isActive ? t('statusActive') : t('statusInactive')}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableDiscount')}
          </dt>
          <dd className="mt-0.5 text-fg">{discountLabel}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableMinOrder')}
          </dt>
          <dd className="mt-0.5 text-fg">
            {formatMoney(promotion.minOrderValue, locale)}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableWindow')}
          </dt>
          <dd className="mt-0.5 truncate text-fg-subtle">
            {formatDateTime(promotion.startDate, locale)} —{' '}
            {formatDateTime(promotion.endDate, locale)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center">
        <Link
          href={`/admin/promotions/${promotion.id}`}
          className="btn-secondary flex-1 !py-2 text-center text-xs"
        >
          {t('actionEdit')}
        </Link>
      </div>
    </article>
  )
}
