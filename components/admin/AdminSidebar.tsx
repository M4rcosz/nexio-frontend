'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import type { AdminRole } from '@/lib/auth/access'

type NavItem = {
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
    | 'workflows'
  icon: React.FC<{ className?: string }>
  /** When true, the entry is only shown to ADMIN. */
  adminOnly?: boolean
}

/**
 * Nav entries grouped by what the operator is doing, not by resource name —
 * eleven flat rows read as a wall. `group` keys live under `admin.nav.groups`.
 *
 * A group whose entries are all `adminOnly` disappears wholesale for a
 * MANAGER; `visibleGroups` drops the heading with it rather than leaving a
 * label over nothing.
 */
const NAV_GROUPS: Array<{
  group: 'operation' | 'catalog' | 'management'
  items: NavItem[]
}> = [
  {
    group: 'operation',
    items: [
      { href: '/admin', key: 'overview', icon: GridIcon },
      { href: '/admin/orders', key: 'orders', icon: OrdersIcon },
      { href: '/admin/menu', key: 'menu', icon: MenuIcon },
      { href: '/admin/inventory', key: 'inventory', icon: BoxIcon },
      // A workflow fires HTTP calls at third parties with stored credentials,
      // so it is ADMIN-only — the pages and the toggle's route handler enforce
      // that independently; this only hides the door.
      {
        href: '/admin/workflows',
        key: 'workflows',
        icon: FlowIcon,
        adminOnly: true,
      },
    ],
  },
  {
    group: 'catalog',
    items: [
      { href: '/admin/products', key: 'products', icon: DishIcon },
      {
        href: '/admin/categories',
        key: 'categories',
        icon: LayersIcon,
        adminOnly: true,
      },
      { href: '/admin/promotions', key: 'promotions', icon: TagIcon },
    ],
  },
  {
    group: 'management',
    items: [
      { href: '/admin/users', key: 'users', icon: UsersIcon },
      // Customers are unreachable for a MANAGER (no unit links to scope by),
      // so the entry would only ever open an empty screen for them.
      {
        href: '/admin/customers',
        key: 'customers',
        icon: UserRoundIcon,
        adminOnly: true,
      },
      {
        href: '/admin/business-units',
        key: 'businessUnits',
        icon: StoreIcon,
        adminOnly: true,
      },
      { href: '/admin/ai', key: 'ai', icon: SparkIcon, adminOnly: true },
    ],
  },
]

type NavGroup = { group: string; items: NavItem[] }

/** Applies the role filter, then drops any group left with no entries. */
function visibleGroups(role: AdminRole): NavGroup[] {
  return NAV_GROUPS.map(({ group, items }) => ({
    group,
    items: items.filter((item) => !item.adminOnly || role === 'ADMIN'),
  })).filter(({ items }) => items.length > 0)
}

export function AdminSidebar({ role }: { role: AdminRole }) {
  const t = useTranslations('admin.nav')
  const pathname = usePathname()

  const groups = visibleGroups(role)

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
        <nav
          aria-label={t('title')}
          className="card overflow-hidden p-0 bg-gradient-to-b from-surface to-surface-2/40"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-gradient" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {t('title')}
            </p>
          </div>
          {/* Caps the rail at the viewport so the longer ADMIN list scrolls
              inside the card instead of running past the sticky offset. */}
          <NavGroups
            groups={groups}
            className="scrollbar-thin max-h-[calc(100vh-11rem)] overflow-y-auto p-2"
          />
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
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-gradient" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                      {t('title')}
                    </p>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t('closeMenu')}
                    className="-mr-2 rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
                <NavGroups
                  groups={groups}
                  onNavigate={() => setOpen(false)}
                  className="scrollbar-thin flex-1 overflow-y-auto p-2"
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  )
}

function NavGroups({
  groups,
  className,
  onNavigate,
}: {
  groups: NavGroup[]
  className?: string
  onNavigate?: () => void
}) {
  const t = useTranslations('admin.nav')
  const pathname = usePathname()

  return (
    <div className={className}>
      {groups.map(({ group, items }, index) => (
        <div key={group} className={index > 0 ? 'mt-5' : undefined}>
          <p className="px-3 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-subtle/80">
            {t(`groups.${group}`)}
          </p>
          <ul className="flex flex-col gap-0.5">
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
                    className={`group relative flex w-full items-center gap-2.5 rounded-xl py-2 pl-3.5 pr-3 text-sm transition-all duration-200 ease-out ${
                      active
                        ? 'bg-brand-500/10 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                        : 'font-medium text-fg-muted hover:bg-surface-2 hover:text-fg'
                    }`}
                  >
                    {/* The position marker. Rendered on every row but scaled
                        to nothing when inactive, so it grows in place instead
                        of popping, and the label never shifts. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gradient transition-transform duration-200 ease-out ${
                        active ? 'scale-y-100' : 'scale-y-0'
                      }`}
                    />
                    <Icon
                      className={`h-4 w-4 flex-none transition-colors ${
                        active
                          ? 'text-brand-600 dark:text-brand-300'
                          : 'text-fg-subtle group-hover:text-fg-muted'
                      }`}
                    />
                    <span className="truncate">{t(key)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
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

/** Single silhouette — keeps Clientes distinguishable from the Usuários pair. */
function UserRoundIcon({ className = '' }: { className?: string }) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
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

/** Two nodes joined by a branch — a graph, not a list of steps. */
function FlowIcon({ className = '' }: { className?: string }) {
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
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <circle cx="18" cy="6" r="2.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" />
      {/* Straight through to the condition, then the branch that falls away. */}
      <path d="M9 6h6.5" />
      <path d="M18 8.5V15" />
      <path d="M6 9v9h9" />
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
