'use client'

import { startTransition, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { backendStatus } from '@/lib/backend-status/store'
import { useBackendStatus } from '@/lib/hooks/useBackendStatus'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const { phase, wokeAt } = useBackendStatus()
  // Only a wake that happens *after* this error rendered should retry it.
  const wokeAtOnMount = useRef(wokeAt)

  // A render error is the strongest hint the backend fell asleep (render
  // fetches time out long before a cold start finishes), so re-probe now
  // rather than waiting for the next tab focus. No-op while already polling.
  useEffect(() => {
    void backendStatus.check()
  }, [])

  // Backend came back: retry the segment. `reset` alone would re-render the
  // cached failed RSC payload; the refresh re-fetches it from the server.
  useEffect(() => {
    if (wokeAt === null || wokeAt === wokeAtOnMount.current) return
    startTransition(() => {
      router.refresh()
      reset()
    })
  }, [wokeAt, router, reset])

  const backendDown = phase === 'waking' || phase === 'unavailable'

  return (
    <div className="card mx-auto max-w-xl overflow-hidden p-0">
      <div className="border-b border-border bg-accent-500/10 p-6">
        <p className="text-[10px] font-mono uppercase tracking-widest text-accent-700 dark:text-accent-300">
          error
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-fg">
          {backendDown ? t('backendStatus.wakingTitle') : t('errors.title')}
        </h2>
      </div>
      <div className="space-y-4 p-6">
        {/* Never render error.message directly: it may be an English backend
            string or leak internals (JWT expiry, stack traces). Show a
            localized, user-friendly message instead. */}
        <p className="text-sm text-fg-muted leading-relaxed">
          {phase === 'waking'
            ? t('backendStatus.errorWaking')
            : phase === 'unavailable'
              ? t('backendStatus.unavailableBody')
              : t('errors.fallback')}
        </p>
        {error.digest ? (
          <p className="font-mono text-[10px] text-fg-muted/70">
            {error.digest}
          </p>
        ) : null}
        <button onClick={reset} className="btn-primary">
          {t('common.tryAgain')}
        </button>
      </div>
    </div>
  )
}
