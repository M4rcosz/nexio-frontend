'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { PasswordInput } from '@/components/PasswordInput'
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter'
import { scorePassword } from '@/lib/validation/password'
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/constants'
import { useRouter } from '@/i18n/navigation'

/**
 * Changes the signed-in user's password. The backend revokes every session on
 * success, so the BFF route clears the cookies and asks us to bounce to login.
 */
export function ChangePasswordForm() {
  const router = useRouter()
  const t = useTranslations('changePassword')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.newPassword !== form.confirm) {
      setError(t('mismatch'))
      return
    }
    if (!scorePassword(form.newPassword).valid) {
      setError(t('weak'))
      return
    }
    start(async () => {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        if (body?.code === 'wrong_password') setError(t('wrongPassword'))
        else if (body?.code === 'same_password') setError(t('samePassword'))
        else setError(errorMessage(body?.code, res.status) ?? t('failed'))
        return
      }
      // Sessions were revoked server-side — send the user back to sign in.
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </div>
      <div>
        <label className="label" htmlFor="current-password">
          {t('currentLabel')}
        </label>
        <PasswordInput
          id="current-password"
          required
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(e) => update('currentPassword', e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="new-password">
          {t('newLabel')}
        </label>
        <PasswordInput
          id="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => update('newPassword', e.target.value)}
        />
        <PasswordStrengthMeter password={form.newPassword} />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">
          {t('confirmLabel')}
        </label>
        <PasswordInput
          id="confirm-password"
          required
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => update('confirm', e.target.value)}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  )
}
