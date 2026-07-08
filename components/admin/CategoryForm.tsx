'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { useRouter } from '@/i18n/navigation'
import { buildCategoryPatch } from '@/lib/admin/buildPatch'
import type { Category, CreateCategoryRequest } from '@/lib/api/types'

type Mode = 'create' | 'edit'

/**
 * Create/edit form for a category (ADMIN only). On create, `isActive` is never
 * sent (categories are born active). On edit, a partial update carries only the
 * fields that changed, and the toggle lets ADMIN activate/deactivate (soft
 * delete). `description` is sent as `undefined` when empty — never null.
 */
export function CategoryForm({
  mode,
  category,
}: {
  mode: Mode
  category?: Category
}) {
  const router = useRouter()
  const t = useTranslations('admin.categories.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: category?.name ?? '',
    description: category?.description ?? '',
    isActive: category?.isActive ?? true,
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'create') {
      const name = form.name.trim()
      if (name.length < 2) {
        setError(t('invalidName'))
        return
      }
      const description = form.description.trim()
      const body: CreateCategoryRequest = {
        name,
        ...(description ? { description } : {}),
      }
      start(async () => {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            code?: string
          } | null
          setError(errorMessage(data?.code, res.status) ?? t('failed'))
          return
        }
        router.push('/admin/categories')
        router.refresh()
      })
      return
    }

    const result = buildCategoryPatch(form, category!)
    if ('error' in result) {
      setError(t(result.error))
      return
    }

    start(async () => {
      const res = await fetch(`/api/categories/${category!.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result.patch),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      router.push('/admin/categories')
      router.refresh()
    })
  }

  // In edit mode, disable the submit until something actually changed.
  const dirty =
    mode === 'create'
      ? true
      : form.name.trim() !== category!.name ||
        form.description.trim() !== (category!.description ?? '') ||
        form.isActive !== category!.isActive

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="category-name">
          {t('name')}
        </label>
        <input
          id="category-name"
          className="input"
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="category-description">
          {t('description')}
        </label>
        <textarea
          id="category-description"
          className="input min-h-[96px]"
          maxLength={255}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
        <p className="mt-1 text-xs text-fg-subtle">{t('descriptionHint')}</p>
      </div>

      {mode === 'edit' ? (
        <div>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
            />
            {t('isActive')}
          </label>
          <p className="mt-1 text-xs text-fg-subtle">{t('isActiveHint')}</p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || !dirty}
        >
          {pending
            ? t('submitting')
            : mode === 'create'
              ? t('submitCreate')
              : t('submitEdit')}
        </button>
      </div>
    </form>
  )
}
