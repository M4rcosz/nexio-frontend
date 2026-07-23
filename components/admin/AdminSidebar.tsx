'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import type { AdminRole } from '@/lib/auth/access'

const NAV: Array<{
  href: string
  key:
    | 'overview'
    | 'orders'
    | 'users'
    | 'customers'
    | 'products'
    | 'categories'
    | 'menu'
    | 'businessUnits'
    | 'inventory'
    | 'promotions'
    | 'ai'
  icon: React.FC<{ className?: string }>
  /** When true, the entry is only shown to ADMIN. */
  adminOnly?: boolean
}> = [
  { href: '/admin', key: 'overview', icon: GridIcon },
  { href: '/admin/orders', key: 'orders', icon: OrdersIcon },
  { href: '/admin/users', key: 'users', icon: UsersIcon },
  // Customers are unreachable for a MANAGER (no unit links to scope by), so
  // the entry would only ever open an empty screen for them.
  {
    href: '/admin/customers',
    key: 'customers',
    icon: UsersIcon,
    adminOnly: true,
  },
  { href: '/admin/products', key: 'products', icon: DishIcon },
  {
    href: '/admin/categories',
    key: 'categories',
    icon: LayersIcon,
    adminOnly: true,
  },
  { href: '/admin/menu', key: 'menu', icon: MenuIcon },
  {
    href: '/admin/business-units',
    key: 'businessUnits',
    icon: StoreIcon,
    adminOnly: true,
  },
  { href: '/admin/inventory', key: 'inventory', icon: BoxIcon },
  { href: '/admin/promotions', key: 'promotions', icon: TagIcon },
  { href: '/admin/ai', key: 'ai', icon: SparkIcon, adminOnly: true },
]

type NavItem = (typeof NAV)[number]

export function AdminSidebar({ role }: { role: AdminRole }) {
  const t = useTranslations('admin.nav')
  const pathname = usePathname()

  const items = NAV.filter((item) => !item.adminOnly || role === 'ADMIN')

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Focus management, focus trap, Escape-to-close and scroll lock while open.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const previouslyFocused = triggerRef.current

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

    getFocusable()[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !panel!.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel!.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  return (
    <>
      {/* Desktop: sticky vertical rail (lg and up). */}
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <nav className="card overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {t('title')}
            </p>
          </div>
          <NavList items={items} className="flex flex-col gap-1 p-2" />
        </nav>
      </aside>

      {/* Mobile: hamburger trigger + slide-over drawer (below lg). */}
      <div className="lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-haspopup="dialog"
          aria-label={t('openMenu')}
          className="btn-secondary w-full justify-between"
        >
          <span className="flex items-center gap-2.5">
            <MenuIcon className="h-4 w-4" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {t('title')}
            </span>
          </span>
        </button>

        {open &&
          createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden
              />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label={t('title')}
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-soft-lg"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                    {t('title')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t('closeMenu')}
                    className="-mr-2 rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
                <NavList
                  items={items}
                  onNavigate={() => setOpen(false)}
                  className="scrollbar-thin flex flex-col gap-1 overflow-y-auto p-2"
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  )
}

function NavList({
  items,
  className,
  onNavigate,
}: {
  items: NavItem[]
  className?: string
  onNavigate?: () => void
}) {
  const t = useTranslations('admin.nav')
  const pathname = usePathname()

  return (
    <ul className={className}>
      {items.map(({ href, key, icon: Icon }) => {
        const active =
          href === '/admin'
            ? pathname === '/admin'
            : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
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
  )
}

function CloseIcon({ className = '' }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function GridIcon({ className = '' }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function OrdersIcon({ className = '' }: { className?: string }) {
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
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function UsersIcon({ className = '' }: { className?: string }) {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function BoxIcon({ className = '' }: { className?: string }) {
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
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  )
}

function DishIcon({ className = '' }: { className?: string }) {
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
      <path d="M3 11h18" />
      <path d="M12 11a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z" />
      <path d="M12 4v3" />
    </svg>
  )
}

function LayersIcon({ className = '' }: { className?: string }) {
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
      <path d="m12 2 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  )
}

function StoreIcon({ className = '' }: { className?: string }) {
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
      <path d="M3 9 4.5 4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function MenuIcon({ className = '' }: { className?: string }) {
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
      <path d="M3 12h18" />
      <path d="M3 6h18" />
      <path d="M3 18h18" />
    </svg>
  )
}

function SparkIcon({ className = '' }: { className?: string }) {
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
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" />
    </svg>
  )
}

function TagIcon({ className = '' }: { className?: string }) {
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
      <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1" />
    </svg>
  )
}
