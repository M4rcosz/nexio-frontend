'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LogoutButton } from '@/components/auth/LogoutButton'

// Fixed palette so avatars stay legible with white text in both themes —
// the color itself is picked deterministically from the username below.
const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-600',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
]

function avatarColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function UserMenu({
  username,
  showPoints,
}: {
  username: string
  /** Points only make sense for customers — staff never earn loyalty points. */
  showPoints: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('header')

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial = username.slice(0, 1).toUpperCase()
  const menuItemClass =
    'block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('greeting', { name: username })}
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ring-2 ring-bg transition-transform hover:scale-105 sm:h-10 sm:w-10 ${avatarColor(username)}`}
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 z-50 mt-2 min-w-48 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-soft-lg"
        >
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-fg">{username}</p>
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              {t('myProfile')}
            </Link>
            {showPoints ? (
              <Link
                href="/loyalty"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={menuItemClass}
              >
                {t('points')}
              </Link>
            ) : null}
          </div>
          <div className="border-t border-border p-1">
            <LogoutButton
              className={menuItemClass}
              role="menuitem"
              onClick={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
