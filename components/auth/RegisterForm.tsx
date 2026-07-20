'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { useUsernameError } from '@/lib/validation/useUsernameError'
import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from '@/lib/validation/constants'
import { useRouter } from '@/i18n/navigation'

export function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const t = useTranslations('register')
  const errorMessage = useErrorMessage()
  const usernameError = useUsernameError()

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  // Instant, client-side feedback. The username is NOT auto-lowercased — an
  // uppercase entry surfaces the pattern error instead of being folded.
  const usernameHint = usernameError(form.username)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        code?: string
        requiresLogin?: boolean
      } | null
      if (!res.ok) {
        // The server stays the source of truth (e.g. a race on the reserved set).
        setError(errorMessage(body?.code, res.status) ?? t('failed'))
        return
      }
      // Account created but auto sign-in did not happen — send them to login.
      router.push(body?.requiresLogin ? '/login' : '/')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="name">
          {t('nameLabel')}
        </label>
        <input
          id="name"
          required
          autoComplete="name"
          className="input"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="email">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">
            {t('usernameLabel')}
          </label>
          <input
            id="username"
            required
            minLength={3}
            maxLength={USERNAME_MAX_LENGTH}
            autoComplete="username"
            className="input"
            aria-invalid={usernameHint ? true : undefined}
            aria-describedby={usernameHint ? 'username-error' : undefined}
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
          />
          {usernameHint ? (
            <p
              id="username-error"
              className="mt-1 text-xs text-accent-700 dark:text-accent-300"
            >
              {usernameHint}
            </p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="phone">
            {t('phoneLabel')}
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            className="input"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t('passwordLabel')}
        </label>
        <PasswordInput
          id="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <PasswordStrengthMeter password={form.password} />
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
