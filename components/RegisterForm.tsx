'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }))
  }

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
      const body = (await res.json().catch(() => null)) as
        | { error?: string; requiresLogin?: boolean }
        | null
      if (!res.ok) {
        setError(body?.error ?? t('failed'))
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
        <label className="label" htmlFor="name">{t('nameLabel')}</label>
        <input id="name" required className="input"
          value={form.name} onChange={(e) => update('name', e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="email">{t('emailLabel')}</label>
        <input id="email" type="email" required className="input"
          value={form.email} onChange={(e) => update('email', e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="username">{t('usernameLabel')}</label>
          <input id="username" required minLength={3} className="input"
            value={form.username} onChange={(e) => update('username', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t('phoneLabel')}</label>
          <input id="phone" className="input"
            value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="password">{t('passwordLabel')}</label>
        <input id="password" type="password" required minLength={8} className="input"
          value={form.password} onChange={(e) => update('password', e.target.value)} />
      </div>
      {error ? (
        <p className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
