'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useCartStore } from '@/lib/cart/store'

/**
 * Rendered when `GET /users/me` answers 404 — the account no longer exists
 * server-side. Clears the session cookies via the logout endpoint and sends the
 * user back to the login screen instead of showing a generic error.
 */
export function AccountGoneRedirect() {
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clear)
  const t = useTranslations('profile')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      if (cancelled) return
      clearCart()
      router.replace('/login')
      router.refresh()
    })()
    return () => {
      cancelled = true
    }
  }, [router, clearCart])

  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="text-5xl" aria-hidden>
        👋
      </span>
      <p className="text-fg-muted">{t('accountGone')}</p>
    </div>
  )
}
