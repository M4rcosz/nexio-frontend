'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const NAV: Array<{ href: string; key: 'overview' | 'users'; icon: React.FC<{ className?: string }> }> = [
  { href: '/admin', key: 'overview', icon: GridIcon },
  { href: '/admin/users', key: 'users', icon: UsersIcon },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const t = useTranslations('admin.nav')

  return (
    <aside className="lg:sticky lg:top-24">
      <nav className="card overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('title')}
          </p>
        </div>
        <ul className="flex flex-row gap-1 p-2 lg:flex-col">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active =
              href === '/admin'
                ? pathname === '/admin'
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-gradient text-white shadow-soft'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-none" />
                  <span>{t(key)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

function GridIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function UsersIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
