'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useCartStore } from '@/lib/cart/store'

export function LogoutButton({
  className = 'rounded-xl px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50',
  role,
  onClick,
}: {
  className?: string
  role?: string
  /** Fired when logout starts — lets a parent menu close itself. */
  onClick?: () => void
} = {}) {
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clear)
  const [pending, start] = useTransition()
  const t = useTranslations('header')

  function logout() {
    onClick?.()
    start(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      clearCart()
      router.push('/')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      role={role}
      onClick={logout}
      disabled={pending}
      className={className}
    >
      {pending ? t('signingOut') : t('signOut')}
    </button>
  )
}
