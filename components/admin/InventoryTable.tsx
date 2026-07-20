'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { InventoryItem } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { InventoryCard } from './InventoryCard'

export function InventoryTable({
  items,
  productNames,
}: {
  items: InventoryItem[]
  /** Map of productId → display name, resolved on the server. */
  productNames: Record<string, string>
}) {
  const t = useTranslations('admin.inventory')
  const locale = useLocale()

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          📦
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            productName={productNames[item.productId] ?? item.productId}
          />
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableProduct')}</th>
                <th className="px-4 py-3 font-medium">{t('tableQuantity')}</th>
                <th className="px-4 py-3 font-medium">{t('tableMin')}</th>
                <th className="px-4 py-3 font-medium">{t('tableUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const low = item.quantity <= item.minQuantity
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">
                        {productNames[item.productId] ?? item.productId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-fg">
                        {item.quantity}
                      </span>
                      {low ? (
                        <span className="ml-2 rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-700 dark:text-accent-300">
                          {t('lowBadge')}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {item.minQuantity}
                    </td>
                    <td className="px-4 py-3 text-xs text-fg-subtle">
                      {formatDateTime(item.updatedAt, locale)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
