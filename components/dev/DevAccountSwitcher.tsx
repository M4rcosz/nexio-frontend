'use client'

import { useState, useTransition } from 'react'
import { useRouter } from '@/i18n/navigation'
import { landingPathForRole } from '@/lib/auth/landing'
import type { Role } from '@/lib/api/types'
import { DEV_SEED_ACCOUNTS, type DevSeedAccount } from '@/lib/dev/seedAccounts'

/**
 * DEV-ONLY quick account switcher. A floating button that expands into a list of
 * seed accounts; clicking one logs in as that user (via the existing
 * /api/auth/login) so you can jump between roles without the logout/login dance.
 *
 * This component must never reach production — it is imported behind a
 * `process.env.NODE_ENV === 'production'` guard in app/[locale]/layout.tsx so the
 * bundler drops it from prod builds entirely.
 *
 * Credentials: usernames are safe to commit (they carry no secret). The password
 * is read from NEXT_PUBLIC_DEV_SEED_PASSWORD (gitignored .env.local); against the
 * mock backend any 4+ char password is accepted, so the fallback works out of the
 * box. Point the env var at your real shared seed password only for throwaway
 * accounts that guard nothing sensitive — it is inlined into the dev bundle.
 */

type DevAccount = DevSeedAccount

// Single source of truth shared with the mock login's role derivation — see
// lib/dev/seedAccounts.ts for why that matters.
const ACCOUNTS: DevAccount[] = DEV_SEED_ACCOUNTS

// The mock accepts any 4+ char password; override for a real backend seed.
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_SEED_PASSWORD || 'devpass1'

const ROLE_CHIP: Record<Role, string> = {
  ADMIN: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  MANAGER: 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
  ATTENDANT: 'bg-forest-500/15 text-forest-700 dark:text-forest-300',
  KITCHEN: 'bg-accent-500/15 text-accent-700 dark:text-accent-300',
  CUSTOMER: 'bg-fg/10 text-fg-muted',
}

export function DevAccountSwitcher({
  currentUsername,
}: {
  currentUsername?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function switchTo(account: DevAccount) {
    setError(null)
    setSwitching(account.username)
    start(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: account.username,
            password: DEV_PASSWORD,
          }),
        })
        if (!res.ok) {
          setError(
            res.status === 401
              ? `Login rejected for ${account.username}. Set NEXT_PUBLIC_DEV_SEED_PASSWORD?`
              : `Switch failed (${res.status}).`,
          )
          return
        }
        const body = (await res.json().catch(() => null)) as {
          role?: string
        } | null
        setOpen(false)
        router.push(landingPathForRole(body?.role ?? account.role))
        router.refresh()
      } catch {
        setError('Network error while switching.')
      } finally {
        setSwitching(null)
      }
    })
  }

  async function signOut() {
    setError(null)
    start(async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      setOpen(false)
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2 print:hidden">
      {open ? (
        <div className="w-72 overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
                dev · switch account
              </p>
              <p className="text-xs text-fg-muted">
                {currentUsername ? `as ${currentUsername}` : 'not signed in'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-fg-subtle hover:text-fg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <ul className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
            {ACCOUNTS.map((acc) => {
              const isCurrent =
                !!currentUsername &&
                acc.username.toLowerCase() === currentUsername.toLowerCase()
              return (
                <li key={acc.username}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => switchTo(acc)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-bg disabled:opacity-50 ${
                      isCurrent ? 'ring-1 ring-inset ring-brand-500/40' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {acc.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-fg-subtle">
                        {acc.username}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_CHIP[acc.role]}`}
                    >
                      {switching === acc.username ? '…' : acc.role}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {error ? (
            <p className="border-t border-border px-4 py-2 text-[11px] leading-snug text-accent-600 dark:text-accent-400">
              {error}
            </p>
          ) : null}
          <div className="border-t border-border px-4 py-2">
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="text-xs font-semibold text-accent-700 hover:underline disabled:opacity-50 dark:text-accent-300"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-elevated text-lg shadow-xl transition hover:scale-105"
        title="Dev: switch account"
        aria-label="Dev: switch account"
      >
        🧑‍💻
      </button>
    </div>
  )
}
