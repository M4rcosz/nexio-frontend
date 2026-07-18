'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import type { Promotion } from '@/lib/api/types'

/**
 * One-click activate/deactivate straight from the list — flipping the flag
 * should not require opening the whole edit form.
 */
export function PromotionToggle({
  promotion,
  className = '',
}: {
  promotion: Promotion
  className?: string
}) {
  const router = useRouter()
  const t = useTranslations('admin.promotions')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    setError(null)
    start(async () => {
      const res = await fetch(`/api/promotions/${promotion.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !promotion.isActive }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('toggleFailed'))
        return
      }
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={className}
      >
        {pending
          ? t('toggling')
          : promotion.isActive
            ? t('actionDeactivate')
            : t('actionActivate')}
      </button>
      {error ? (
        <span
          role="alert"
          className="text-xs text-accent-700 dark:text-accent-300"
        >
          {error}
        </span>
      ) : null}
    </span>
  )
}
