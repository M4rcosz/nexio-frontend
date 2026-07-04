'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { useRouter } from '@/i18n/navigation'
import type { ProductResponseDto, ProductUpdateDto } from '@/lib/api/types'

const MONEY_RE = /^\d+(\.\d{1,2})?$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Edit form for a product (ADMIN only). Sends a partial update with only the
 * fields that actually changed. `isActive` is managed elsewhere (activate/
 * deactivate) and `description` cannot be cleared to null here.
 */
export function ProductForm({ product }: { product: ProductResponseDto }) {
  const router = useRouter()
  const t = useTranslations('admin.products.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    // TODO: turn categoryId into a Select once a categories endpoint exists.
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  /** Collect only the fields that changed relative to the loaded product. */
  function buildPatch(): { patch: ProductUpdateDto } | { error: string } {
    const patch: ProductUpdateDto = {}

    const name = form.name.trim()
    if (name !== product.name) {
      if (name.length < 2) return { error: t('invalidName') }
      patch.name = name
    }

    // description cannot be cleared to null — only send it when non-empty.
    const description = form.description.trim()
    if (description && description !== (product.description ?? '')) {
      patch.description = description
    }

    const price = form.price.trim()
    if (price !== product.price) {
      if (!MONEY_RE.test(price) || Number(price) <= 0) {
        return { error: t('invalidMoney') }
      }
      patch.price = price
    }

    const categoryId = form.categoryId.trim()
    if (categoryId !== product.categoryId) {
      if (!UUID_RE.test(categoryId)) {
        return { error: t('invalidCategory') }
      }
      patch.categoryId = categoryId
    }

    const imageUrl = form.imageUrl.trim()
    if (imageUrl && imageUrl !== (product.imageUrl ?? '')) {
      patch.imageUrl = imageUrl
    }

    if (Object.keys(patch).length === 0) return { error: t('noChanges') }
    return { patch }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const result = buildPatch()
    if ('error' in result) {
      setError(result.error)
      return
    }

    start(async () => {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result.patch),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { code?: string }
          | null
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      router.push('/admin/products')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="product-name">
          {t('name')}
        </label>
        <input
          id="product-name"
          className="input"
          required
          minLength={2}
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="product-description">
          {t('description')}
        </label>
        <textarea
          id="product-description"
          className="input min-h-[96px]"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
        <p className="mt-1 text-xs text-fg-subtle">{t('descriptionHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="product-price">
            {t('price')}
          </label>
          <input
            id="product-price"
            className="input"
            inputMode="decimal"
            placeholder="58.90"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
          />
          <p className="mt-1 text-xs text-fg-subtle">{t('priceHint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="product-category">
            {t('categoryId')}
          </label>
          <input
            id="product-category"
            className="input font-mono text-xs"
            value={form.categoryId}
            onChange={(e) => update('categoryId', e.target.value)}
          />
          <p className="mt-1 text-xs text-fg-subtle">{t('categoryHint')}</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="product-image">
          {t('imageUrl')}
        </label>
        <input
          id="product-image"
          className="input"
          type="url"
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(e) => update('imageUrl', e.target.value)}
        />
        <p className="mt-1 text-xs text-fg-subtle">{t('imageUrlHint')}</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? t('submitting') : t('submitEdit')}
        </button>
      </div>
    </form>
  )
}
