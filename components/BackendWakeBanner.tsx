'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { backendStatus } from '@/lib/backend-status/store'
import { useBackendStatus } from '@/lib/hooks/useBackendStatus'

/** How long the "ready" confirmation stays up after a wake. */
const READY_NOTICE_MS = 4000

/**
 * Tells the visitor the backend is cold-starting (Render free tier) instead of
 * leaving them on a skeleton or an error page, and refreshes the route once it
 * answers so server-rendered data fills in without a manual reload.
 *
 * Mounted once in the `[locale]` layout, so it probes on every hard load and
 * survives soft navigation; tab refocus re-probes when the last answer is
 * stale (a tab left open past the backend's idle timeout). A fixed toast, not
 * an inline bar, so appearing and disappearing never shifts the layout.
 */
export function BackendWakeBanner() {
  const t = useTranslations('backendStatus')
  const router = useRouter()
  const { phase, wokeAt } = useBackendStatus()
  const [showReady, setShowReady] = useState(false)

  useEffect(() => {
    void backendStatus.check()
    function recheckIfVisible() {
      if (document.visibilityState === 'visible') {
        void backendStatus.checkIfStale()
      }
    }
    document.addEventListener('visibilitychange', recheckIfVisible)
    window.addEventListener('focus', recheckIfVisible)
    return () => {
      document.removeEventListener('visibilitychange', recheckIfVisible)
      window.removeEventListener('focus', recheckIfVisible)
    }
  }, [])

  useEffect(() => {
    if (wokeAt === null) return
    // Re-run the server render that timed out while the backend was asleep.
    router.refresh()
    setShowReady(true)
    const id = setTimeout(() => setShowReady(false), READY_NOTICE_MS)
    return () => clearTimeout(id)
  }, [wokeAt, router])

  const visible =
    phase === 'waking' ||
    phase === 'unavailable' ||
    (phase === 'up' && showReady)

  return (
    // The live region is always mounted so screen readers announce changes
    // to its content; an aria-live node inserted together with its text is
    // often missed.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {visible ? (
        <div className="card pointer-events-auto flex w-full max-w-md items-start gap-3 p-4 shadow-soft-lg">
          {phase === 'waking' ? (
            <span
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500"
            />
          ) : (
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${phase === 'up' ? 'bg-brand-500' : 'bg-accent-500'}`}
            />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-fg">
              {phase === 'waking'
                ? t('wakingTitle')
                : phase === 'unavailable'
                  ? t('unavailableTitle')
                  : t('readyTitle')}
            </p>
            {phase !== 'up' ? (
              <p className="text-xs leading-relaxed text-fg-muted">
                {phase === 'waking' ? t('wakingBody') : t('unavailableBody')}
              </p>
            ) : null}
            {phase === 'unavailable' ? (
              <button
                type="button"
                onClick={() => void backendStatus.check()}
                className="btn-secondary mt-2"
              >
                {t('retry')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
