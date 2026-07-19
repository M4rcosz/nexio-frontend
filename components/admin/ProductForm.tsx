'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Select } from '@/components/ui/Select'
import { useRouter } from '@/i18n/navigation'
import { buildProductPatch } from '@/lib/admin/buildPatch'
import type {
  Category,
  CreateProductRequest,
  ProductResponseDto,
} from '@/lib/api/types'

type Mode = 'create' | 'edit'

const MONEY_RE = /^\d+(\.\d{1,2})?$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Create/edit form for a product (ADMIN only). On create, every field is sent
 * and `imageUrl` is required (unlike edit). On edit, a partial update carries
 * only the fields that changed; `isActive` is managed elsewhere (activate/
 * deactivate) and `description`/`imageUrl` cannot be cleared to null here.
 */
export function ProductForm({
  mode,
  product,
  categories,
}: {
  mode: Mode
  product?: ProductResponseDto
  categories: Category[]
}) {
  const router = useRouter()
  const t = useTranslations('admin.products.form')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    categoryId: product?.categoryId ?? categories[0]?.id ?? '',
    imageUrl: product?.imageUrl ?? '',
  })

  // Only active categories are listed, so a product tied to a deactivated
  // category would have no matching option. Surface it explicitly so the Select
  // still shows the current value instead of appearing empty.
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }))
  if (product && !categoryOptions.some((o) => o.value === product.categoryId)) {
    categoryOptions.unshift({
      value: product.categoryId,
      label: t('categoryInactiveOption'),
    })
  }

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }))
  }

  /** Validate and assemble the full create payload. */
  function buildCreate(): { body: CreateProductRequest } | { error: string } {
    const name = form.name.trim()
    if (name.length < 2) return { error: t('invalidName') }

    const price = form.price.trim()
    if (!MONEY_RE.test(price) || Number(price) <= 0) {
      return { error: t('invalidMoney') }
    }

    const categoryId = form.categoryId.trim()
    if (!UUID_RE.test(categoryId)) return { error: t('invalidCategory') }

    const imageUrl = form.imageUrl.trim()
    if (!/^https?:\/\/.+/i.test(imageUrl))
      return { error: t('invalidImageUrl') }

    const description = form.description.trim()
    return {
      body: {
        name,
        price,
        categoryId,
        imageUrl,
        ...(description ? { description } : {}),
      },
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'create') {
      const result = buildCreate()
      if ('error' in result) {
        setError(result.error)
        return
      }
      start(async () => {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(result.body),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            code?: string
          } | null
          setError(errorMessage(data?.code, res.status) ?? t('failed'))
          return
        }
        router.refresh()
        router.push('/admin/products')
      })
      return
    }

    const result = buildProductPatch(form, product!)
    if ('error' in result) {
      setError(t(result.error))
      return
    }

    start(async () => {
      const res = await fetch(`/api/products/${product!.id}`, {
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
      router.refresh()
      router.push('/admin/products')
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
          <Select
            id="product-category"
            value={form.categoryId}
            onChange={(v) => update('categoryId', v)}
            ariaLabel={t('categoryId')}
            options={categoryOptions}
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
          required={mode === 'create'}
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(e) => update('imageUrl', e.target.value)}
        />
        <p className="mt-1 text-xs text-fg-subtle">
          {mode === 'create' ? t('imageUrlCreateHint') : t('imageUrlHint')}
        </p>
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
