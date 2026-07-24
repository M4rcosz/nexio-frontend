'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select, type SelectOption } from '@/components/ui/Select'
import { formatDateTime } from '@/lib/format'
import { AI_TOKEN_MAX } from '@/lib/validation/constants'
import type { AiMembership, Paginated, Role, User } from '@/lib/api/types'

type PickableUser = {
  id: string
  name: string
  username: string
  role: Role
}

type Feedback = { kind: 'success' | 'error'; message: string }

type Action = 'enroll' | 'adjust' | 'revoke' | 'reinstate'

/**
 * ADMIN panel to enroll a user in the AI assistant (grant an initial token
 * wallet), top up / claw back an enrolled user's balance, and revoke or
 * reinstate their access. There is no "read another user's balance" endpoint,
 * so the panel is action-oriented: pick a target, then act; the server is
 * authoritative and every mutation returns the fresh row, which is what drives
 * the state badge below (see {@link membership}).
 *
 * No action button is disabled for a missing target: each handler already
 * answers "Choose a target user first", which is more useful than a dead
 * button that never says why. Nothing reaches the network in that case.
 *
 * `users` seeds the picker so it isn't empty on first open; typing then runs a
 * live server search against `/api/admin/users` (staff only — that route never
 * honours CUSTOMER), so any internal user is reachable, not just the first page.
 */
export function AiMembershipManager({ users }: { users: PickableUser[] }) {
  const t = useTranslations('admin.ai')
  const locale = useLocale()
  const router = useRouter()

  const [userId, setUserId] = useState('')
  // Starts at 0 rather than empty: the stepper's −/+ need a number to move
  // from, and 0 is a valid grant on its own.
  const [initialBalance, setInitialBalance] = useState('0')
  const [delta, setDelta] = useState('')
  const [busy, setBusy] = useState<Action | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, start] = useTransition()

  /**
   * The picked target's row as of the last successful mutation, or `null` while
   * we have not seen one. It is deliberately NOT a fetch: no endpoint reads
   * another user's membership, so "unknown" is a real state and every control
   * stays enabled in it — the server rejects what isn't allowed and we map the
   * status. Cleared whenever the target changes so one user's state can never
   * be shown against another.
   */
  const [membership, setMembership] = useState<AiMembership | null>(null)

  // Live-search state: `results` is the current page of matches (seeded with
  // the server-rendered roster); `picked` is remembered separately so the
  // chosen user's name survives a later search that no longer lists them.
  const [results, setResults] = useState<PickableUser[]>(users)
  const [picked, setPicked] = useState<PickableUser | null>(null)
  const [searching, setSearching] = useState(false)
  const searchSeq = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = picked && picked.id === userId.trim() ? picked : undefined
  /** Only true when we have actually seen a revoked row — an unknown state
   * must not disable the controls, or an admin could never act on a target
   * whose membership they have not touched in this session. */
  const revoked = membership?.revokedAt != null

  const label = (u: PickableUser) => `${u.name} · ${u.username}`

  // Dropdown options hide the raw UUID — staff pick by the human identity
  // (name · username); the value we carry under the hood is still the id.
  const userOptions = useMemo<SelectOption[]>(() => {
    const opts = results.map((u) => ({ value: u.id, label: label(u) }))
    if (picked && !results.some((u) => u.id === picked.id)) {
      opts.unshift({ value: picked.id, label: label(picked) })
    }
    return opts
  }, [results, picked])

  // Fetch a page of internal users matching `q` (empty → the default page).
  // A monotonic sequence guards against a slow earlier request clobbering the
  // results of a newer keystroke.
  const runSearch = useCallback(async (q: string) => {
    const seq = ++searchSeq.current
    setSearching(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (q.trim()) params.set('search', q.trim())
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) return
      const page = (await res.json()) as Paginated<User>
      if (seq !== searchSeq.current) return
      setResults(
        page.data.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
        })),
      )
    } catch {
      // Transient failure — keep whatever list is already shown.
    } finally {
      if (seq === searchSeq.current) setSearching(false)
    }
  }, [])

  const handleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => runSearch(q), 250)
    },
    [runSearch],
  )

  function pickUser(id: string) {
    setUserId(id)
    const u = results.find((r) => r.id === id)
    if (u) setPicked(u)
    // Nothing known about the new target yet — and showing the previous one's
    // balance/revoked badge here would be actively misleading.
    setMembership(null)
    setFeedback(null)
  }

  function fmt(n: number) {
    return n.toLocaleString(locale)
  }

  function enroll() {
    const id = userId.trim()
    const value = Number(initialBalance)
    if (!id) {
      setFeedback({ kind: 'error', message: t('pickUserFirst') })
      return
    }
    if (
      initialBalance.trim() === '' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > AI_TOKEN_MAX
    ) {
      setFeedback({ kind: 'error', message: t('invalidBalance') })
      return
    }
    setFeedback(null)
    setBusy('enroll')
    start(async () => {
      try {
        const res = await fetch(
          `/api/ai/memberships/${encodeURIComponent(id)}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ initialBalance: value }),
          },
        )
        if (res.ok) {
          const m = (await res.json()) as AiMembership
          setMembership(m)
          setInitialBalance('0')
          setFeedback({
            kind: 'success',
            message: t('enrollSuccess', { balance: fmt(m.tokenBalance) }),
          })
          // Re-render server components so, if the admin just granted access to
          // themselves, the header's Assistant link appears without a reload.
          router.refresh()
          return
        }
        setFeedback({ kind: 'error', message: enrollError(res.status) })
      } catch {
        setFeedback({ kind: 'error', message: t('networkError') })
      } finally {
        setBusy(null)
      }
    })
  }

  function adjust() {
    const id = userId.trim()
    const value = Number(delta)
    if (!id) {
      setFeedback({ kind: 'error', message: t('pickUserFirst') })
      return
    }
    if (
      delta.trim() === '' ||
      !Number.isInteger(value) ||
      value === 0 ||
      Math.abs(value) > AI_TOKEN_MAX
    ) {
      setFeedback({ kind: 'error', message: t('invalidDelta') })
      return
    }
    setFeedback(null)
    setBusy('adjust')
    start(async () => {
      try {
        const res = await fetch(
          `/api/ai/memberships/${encodeURIComponent(id)}/balance`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ delta: value }),
          },
        )
        if (res.ok) {
          const m = (await res.json()) as AiMembership
          setMembership(m)
          setDelta('')
          setFeedback({
            kind: 'success',
            message: t('adjustSuccess', { balance: fmt(m.tokenBalance) }),
          })
          router.refresh()
          return
        }
        setFeedback({ kind: 'error', message: adjustError(res.status) })
      } catch {
        setFeedback({ kind: 'error', message: t('networkError') })
      } finally {
        setBusy(null)
      }
    })
  }

  /**
   * Revoke and reinstate share a shape: no body, and both are idempotent
   * upstream, so a repeat call is a no-op returning the current row rather than
   * an error — no double-submit guard is needed beyond the disabled button.
   */
  function setAccess(action: 'revoke' | 'reinstate') {
    const id = userId.trim()
    if (!id) {
      setFeedback({ kind: 'error', message: t('pickUserFirst') })
      return
    }
    setFeedback(null)
    setBusy(action)
    start(async () => {
      try {
        const path = `/api/ai/memberships/${encodeURIComponent(id)}${
          action === 'reinstate' ? '/reinstate' : ''
        }`
        const res = await fetch(path, {
          method: action === 'revoke' ? 'DELETE' : 'POST',
        })
        if (res.ok) {
          const m = (await res.json()) as AiMembership
          setMembership(m)
          setFeedback({
            kind: 'success',
            message:
              action === 'revoke'
                ? t('revokeSuccess', { balance: fmt(m.tokenBalance) })
                : t('reinstateSuccess', { balance: fmt(m.tokenBalance) }),
          })
          // If the admin just changed their own access, the header's Assistant
          // link has to appear/disappear without a manual reload.
          router.refresh()
          return
        }
        setFeedback({
          kind: 'error',
          message:
            res.status === 404 ? t('notEnrolled') : accessError(res.status),
        })
      } catch {
        setFeedback({ kind: 'error', message: t('networkError') })
      } finally {
        setBusy(null)
      }
    })
  }

  function enrollError(status: number): string {
    if (status === 409) return t('alreadyEnrolled')
    if (status === 404) return t('userNotFound')
    if (status === 400) return t('invalidBalance')
    if (status === 403) return t('forbidden')
    return t('genericError')
  }

  function adjustError(status: number): string {
    if (status === 404) return t('notEnrolled')
    if (status === 422) return t('outOfRange')
    if (status === 400) return t('invalidDelta')
    // On this route a 403 means the membership is revoked, not that the admin
    // lacks permission — the BFF gates the role before the call is made.
    if (status === 403) return t('revokedBlocksAdjust')
    return t('genericError')
  }

  function accessError(status: number): string {
    if (status === 403) return t('forbidden')
    return t('genericError')
  }

  return (
    <div className="space-y-5">
      {/* Target picker (shared by both actions) */}
      <section className="card p-6">
        <label
          htmlFor="ai-user-id"
          className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle"
        >
          {t('targetUser')}
        </label>
        <div className="mt-2">
          <Select
            id="ai-user-id"
            value={userId}
            onChange={pickUser}
            options={userOptions}
            ariaLabel={t('targetUser')}
            placeholder={t('targetUserPlaceholder')}
            onSearch={handleSearch}
            searchPlaceholder={t('targetSearchPlaceholder')}
            noResultsLabel={t('targetNoResults')}
            loading={searching}
            loadingLabel={t('targetSearching')}
          />
        </div>
        <p className="mt-2 text-xs text-fg-subtle">
          {selected
            ? t('targetSelected', {
                name: selected.name,
                username: selected.username,
              })
            : t('targetHint')}
        </p>

        {/* Known state, shown only once a mutation has told us what it is. */}
        {membership ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                revoked
                  ? 'bg-accent-500/15 text-accent-700 dark:text-accent-300'
                  : 'bg-forest-500/15 text-forest-700 dark:text-forest-300'
              }`}
            >
              {revoked ? t('stateRevoked') : t('stateActive')}
            </span>
            <span className="text-xs text-fg-muted">
              {t('stateBalance', { balance: fmt(membership.tokenBalance) })}
            </span>
            {revoked && membership.revokedAt ? (
              <span className="text-xs text-fg-subtle">
                {t('revokedOn', {
                  date: formatDateTime(membership.revokedAt, locale),
                })}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {feedback ? (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border p-3 text-sm ${
            feedback.kind === 'error'
              ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-300'
              : 'border-forest-500/30 bg-forest-500/10 text-forest-700 dark:text-forest-300'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Enroll */}
        <section className="card p-6">
          <h2 className="font-semibold text-fg">{t('enrollTitle')}</h2>
          <p className="mt-1 text-xs text-fg-muted">{t('enrollHint')}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              enroll()
            }}
          >
            <TokenStepper
              value={initialBalance}
              onChange={setInitialBalance}
              label={t('initialBalanceLabel')}
              placeholder={t('initialBalancePlaceholder')}
              // A grant can only add tokens; the clawback lives in Adjust.
              min={0}
              max={AI_TOKEN_MAX}
            />
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full"
            >
              {busy === 'enroll' ? t('working') : t('enrollButton')}
            </button>
          </form>
        </section>

        {/* Adjust */}
        <section className="card p-6">
          <h2 className="font-semibold text-fg">{t('adjustTitle')}</h2>
          <p className="mt-1 text-xs text-fg-muted">{t('adjustHint')}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              adjust()
            }}
          >
            <TokenStepper
              value={delta}
              onChange={setDelta}
              label={t('deltaLabel')}
              placeholder={t('deltaPlaceholder')}
              // Signed: a clawback is just a negative adjustment.
              min={-AI_TOKEN_MAX}
              max={AI_TOKEN_MAX}
            />
            <button
              type="submit"
              // Adjusting a revoked membership is a guaranteed 403 — reinstate
              // first. Only disabled when we actually know it is revoked.
              disabled={pending || revoked}
              className="btn-primary w-full"
            >
              {busy === 'adjust' ? t('working') : t('adjustButton')}
            </button>
            {revoked ? (
              <p className="text-xs text-accent-600">
                {t('revokedBlocksAdjust')}
              </p>
            ) : null}
          </form>
        </section>
      </div>

      {/* Access — revoke / reinstate */}
      <section className="card p-6">
        <h2 className="font-semibold text-fg">{t('accessTitle')}</h2>
        <p className="mt-1 text-xs text-fg-muted">{t('accessHint')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirmingRevoke(true)}
            disabled={pending || revoked}
            className="btn-secondary flex-1 border-accent-500/40 text-accent-700 disabled:opacity-50 dark:text-accent-300"
          >
            {busy === 'revoke' ? t('working') : t('revokeButton')}
          </button>
          <button
            type="button"
            onClick={() => setAccess('reinstate')}
            disabled={pending || membership?.revokedAt === null}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            {busy === 'reinstate' ? t('working') : t('reinstateButton')}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmingRevoke}
        title={t('revokeButton')}
        // Says the balance survives: an admin who expects revoke to also zero
        // the wallet would otherwise skip the separate clawback they wanted.
        message={t('revokeConfirm')}
        confirmLabel={t('revokeButton')}
        danger
        onConfirm={() => {
          setConfirmingRevoke(false)
          setAccess('revoke')
        }}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </div>
  )
}

/** How much one press of −/+ moves a token field. */
const TOKEN_STEP = 1000

/**
 * Whole-number token field flanked by −/+ buttons. Shared by Enroll and Adjust
 * so both read the same way; they differ only in `min` (a grant can't go
 * negative, an adjustment can). Values stay strings — the field is free-typed
 * and each caller runs its own validation before submitting.
 */
function TokenStepper({
  value,
  onChange,
  label,
  placeholder,
  min,
  max,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  min: number
  max: number
}) {
  const t = useTranslations('admin.ai')

  /** Nudge by ±{@link TOKEN_STEP}, clamped, treating a junk field as 0. */
  function step(direction: 1 | -1) {
    const n = Number(value)
    const base = value.trim() !== '' && Number.isInteger(n) ? n : 0
    onChange(
      String(Math.min(max, Math.max(min, base + direction * TOKEN_STEP))),
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => step(-1)}
        className="btn-secondary !px-3 !py-2.5"
        aria-label={t('decrement', { field: label })}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="no-spinner w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-center text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60"
      />
      <button
        type="button"
        onClick={() => step(1)}
        className="btn-secondary !px-3 !py-2.5"
        aria-label={t('increment', { field: label })}
      >
        +
      </button>
    </div>
  )
}
