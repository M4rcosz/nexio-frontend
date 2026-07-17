'use client'

import { useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AI_TOKEN_MAX } from '@/lib/validation/constants'
import type { AiMembership, Role } from '@/lib/api/types'

type PickableUser = {
  id: string
  name: string
  username: string
  role: Role
}

type Feedback = { kind: 'success' | 'error'; message: string }

/**
 * ADMIN panel to enroll a user in the AI assistant (grant an initial token
 * wallet) and to top up / claw back an enrolled user's balance. There is no
 * "read another user's balance" endpoint, so the panel is action-oriented: pick
 * a target, then either enroll or adjust; the server is authoritative and the
 * result balance comes back on success.
 */
export function AiMembershipManager({ users }: { users: PickableUser[] }) {
  const t = useTranslations('admin.ai')
  const locale = useLocale()

  const [userId, setUserId] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [delta, setDelta] = useState('')
  const [busy, setBusy] = useState<'enroll' | 'adjust' | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pending, start] = useTransition()

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const selected = usersById.get(userId.trim())
  const hasTarget = userId.trim().length > 0

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
          setInitialBalance('')
          setFeedback({
            kind: 'success',
            message: t('enrollSuccess', { balance: fmt(m.tokenBalance) }),
          })
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
          setDelta('')
          setFeedback({
            kind: 'success',
            message: t('adjustSuccess', { balance: fmt(m.tokenBalance) }),
          })
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
        <input
          id="ai-user-id"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          list="ai-user-options"
          placeholder={t('targetUserPlaceholder')}
          className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60"
        />
        <datalist id="ai-user-options">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.username} · {u.role}
            </option>
          ))}
        </datalist>
        <p className="mt-2 text-xs text-fg-subtle">
          {selected
            ? t('targetSelected', {
                name: selected.name,
                username: selected.username,
              })
            : t('targetHint')}
        </p>
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
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={AI_TOKEN_MAX}
              step={1}
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder={t('initialBalancePlaceholder')}
              aria-label={t('initialBalanceLabel')}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60"
            />
            <button
              type="submit"
              disabled={pending || !hasTarget}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDelta((v) => signedStep(v, -1))}
                className="btn-secondary !px-3 !py-2.5"
                aria-label={t('decrement')}
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder={t('deltaPlaceholder')}
                aria-label={t('deltaLabel')}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-center text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60"
              />
              <button
                type="button"
                onClick={() => setDelta((v) => signedStep(v, 1))}
                className="btn-secondary !px-3 !py-2.5"
                aria-label={t('increment')}
              >
                +
              </button>
            </div>
            <button
              type="submit"
              disabled={pending || !hasTarget}
              className="btn-primary w-full"
            >
              {busy === 'adjust' ? t('working') : t('adjustButton')}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

/** Nudge the signed delta field by ±1000, keeping it an integer. */
function signedStep(current: string, direction: 1 | -1): string {
  const n = Number(current)
  const base = Number.isFinite(n) && Number.isInteger(n) ? n : 0
  return String(base + direction * 1000)
}
