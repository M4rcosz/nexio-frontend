'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { NAME_MAX_LENGTH, PHONE_MAX_LENGTH } from '@/lib/validation/constants'
import { useRouter } from '@/i18n/navigation'

/**
 * Editable name/phone for the signed-in user (`PATCH /users/me`). At least one
 * field must change; empty fields are only sent when they actually differ from
 * the current value so an untouched field is never wiped.
 */
export function EditProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string
  initialPhone: string
}) {
  const router = useRouter()
  const t = useTranslations('profile.edit')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Only send fields the user actually changed. `PATCH /users/me` requires at
    // least one, so bail out early when nothing changed.
    const body: { name?: string; phone?: string } = {}
    if (name.trim() !== initialName) body.name = name.trim()
    if (phone.trim() !== initialPhone) body.phone = phone.trim()
    if (body.name === undefined && body.phone === undefined) {
      setError(t('atLeastOne'))
      return
    }

    start(async () => {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        if (data?.code === 'phone_taken') setError(t('phoneTaken'))
        else setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      setSuccess(t('success'))
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </div>
      <div>
        <label className="label" htmlFor="profile-name">
          {t('nameLabel')}
        </label>
        <input
          id="profile-name"
          className="input"
          required
          minLength={2}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="profile-phone">
          {t('phoneLabel')}
        </label>
        <input
          id="profile-phone"
          className="input"
          type="tel"
          maxLength={PHONE_MAX_LENGTH}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-xl border border-forest-500/30 bg-forest-500/10 p-3 text-sm text-forest-700 dark:text-forest-300"
        >
          {success}
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
