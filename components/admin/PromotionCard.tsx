'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import type { Promotion } from '@/lib/api/types'
import { formatMoney } from '@/lib/money'
import { formatDateTime } from '@/lib/format'
import { PromotionStatusBadge } from './PromotionStatusBadge'
import { PromotionToggle } from './PromotionToggle'

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
        <PromotionStatusBadge promotion={promotion} />
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
      <div className="mt-4 grid grid-cols-2 items-start gap-2">
        <PromotionToggle
          promotion={promotion}
          className="btn-ghost min-h-[44px] w-full !py-2 text-center text-xs"
        />
        <Link
          href={`/admin/promotions/${promotion.id}`}
          className="btn-secondary min-h-[44px] !py-2 text-center text-xs"
        >
          {t('actionEdit')}
        </Link>
      </div>
    </article>
  )
}
