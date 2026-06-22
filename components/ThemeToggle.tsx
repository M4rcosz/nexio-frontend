'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

type Theme = 'dark' | 'light'

const COOKIE_NAME = 'theme'
const ONE_YEAR = 60 * 60 * 24 * 365

export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)
  const t = useTranslations('themeToggle')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`
  }, [theme])

  const isDark = theme === 'dark'
  const label = isDark ? t('switchToLight') : t('switchToDark')

  return (
    <button
      type="button"
      onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
      aria-label={label}
      title={label}
      className="group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      <SunIcon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark
            ? 'rotate-90 scale-50 opacity-0'
            : 'rotate-0 scale-100 opacity-100'
        }`}
      />
      <MoonIcon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          isDark
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-50 opacity-0'
        }`}
      />
    </button>
  )
}

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
