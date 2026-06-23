'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { InventoryItem } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

/** Mobile-friendly variant of an InventoryTable row — used below `md` screens. */
export function InventoryCard({
  item,
  productName,
}: {
  item: InventoryItem
  productName: string
}) {
  const t = useTranslations('admin.inventory')
  const locale = useLocale()
  const low = item.quantity <= item.minQuantity

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold text-fg">
          {productName}
        </p>
        {low ? (
          <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-700 dark:text-accent-300">
            {t('lowBadge')}
          </span>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
        <div>
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableQuantity')}
          </dt>
          <dd className="mt-0.5 font-medium text-fg">{item.quantity}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableMin')}
          </dt>
          <dd className="mt-0.5 text-fg">{item.minQuantity}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="font-mono uppercase tracking-widest text-fg-subtle">
            {t('tableUpdated')}
          </dt>
          <dd className="mt-0.5 truncate text-fg-subtle">
            {formatDateTime(item.updatedAt, locale)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
