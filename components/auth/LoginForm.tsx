'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { landingPathForRole } from '@/lib/auth/landing'
import { PasswordInput } from '@/components/ui/PasswordInput'
import {
  PASSWORD_LOGIN_MIN_LENGTH,
  USERNAME_LOGIN_MAX_LENGTH,
} from '@/lib/validation/constants'

export function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const t = useTranslations('login')
  const errorMessage = useErrorMessage()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Trim the username so a stray leading/trailing space never breaks login.
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          setError(t('invalidCredentials'))
          return
        }
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('failed'))
        return
      }
      // Honor an explicit redirect (protected route the user came from);
      // otherwise send them to the landing page for their role.
      const body = (await res.json().catch(() => null)) as {
        role?: string
      } | null
      router.push(redirectTo ?? landingPathForRole(body?.role))
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="username">
          {t('usernameLabel')}
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className="input"
          required
          maxLength={USERNAME_LOGIN_MAX_LENGTH}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t('passwordLabel')}
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={PASSWORD_LOGIN_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
