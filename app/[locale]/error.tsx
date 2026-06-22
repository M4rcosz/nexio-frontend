'use client'

import { useTranslations } from 'next-intl'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations()
  return (
    <div className="card mx-auto max-w-xl overflow-hidden p-0">
      <div className="border-b border-border bg-accent-500/10 p-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-accent-700 dark:text-accent-300">
          error
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-fg">
          {t('errors.title')}
        </h2>
      </div>
      <div className="space-y-4 p-6">
        <p className="text-sm text-fg-muted leading-relaxed">
          {error.message || t('errors.fallback')}
        </p>
        <button onClick={reset} className="btn-primary">
          {t('common.tryAgain')}
        </button>
      </div>
    </div>
  )
}
