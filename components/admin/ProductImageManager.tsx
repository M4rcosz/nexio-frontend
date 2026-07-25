'use client'

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProductImage } from '@/components/ui/ProductImage'
import {
  ProductImageUploadError,
  uploadProductImage,
  type UploadFailureCode,
  type UploadPhase,
} from '@/lib/products/imageUpload'
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_BYTES,
} from '@/lib/validation/constants'
import type { ProductResponseDto } from '@/lib/api/types'

const MEGABYTES = PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024)

/**
 * Upload / replace / clear the image of an existing product.
 *
 * **The two controls have different roles.** Uploading is ADMIN + MANAGER
 * (`/image/upload-url` + `/image/confirm`), while clearing goes through
 * `PATCH /products/:id`, which is ADMIN-only. So a MANAGER can replace an
 * image but not remove one, and the clear control is hidden for them rather
 * than left to 403 on click. `canClear` is presentation only — both route
 * handlers enforce their own role check.
 *
 * State is modelled as an explicit phase rather than an `isUploading` boolean:
 * the three-call flow fails in places that need different recovery (a spent
 * mint budget, an upload that never landed, bytes the bucket rejected), and a
 * boolean collapses them into one indistinguishable "failed".
 */
export function ProductImageManager({
  product: initialProduct,
  canClear,
}: {
  product: ProductResponseDto
  canClear: boolean
}) {
  const t = useTranslations('admin.products.image')
  const router = useRouter()
  const errorMessage = useErrorMessage()
  const hintId = useId()

  // Confirm returns the full updated product, so the preview is driven from
  // that response. Refetching instead can race the CDN and show the old image.
  //
  // Deliberately not re-synced from the prop: after a confirm this local copy
  // is the newer of the two. The product's other fields are edited by
  // `ProductForm`, which navigates away on save, so they cannot drift here.
  const [product, setProduct] = useState(initialProduct)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const pickButtonRef = useRef<HTMLButtonElement>(null)
  // Not aborted on unmount on purpose: if the user navigates away mid-flight,
  // letting the confirm land is better than orphaning bytes that are already
  // in the bucket. The request is short and carries no UI state with it.
  const abortRef = useRef<AbortController | null>(null)

  const busy = phase !== 'idle'
  // Cancelling is only meaningful before the bytes land. Once `confirm` is in
  // flight the upload has already happened, and aborting our own request would
  // not un-run the handler — the server would take the new image while the UI
  // silently kept showing the old one.
  const cancellable = phase === 'minting' || phase === 'uploading'

  function messageFor(code: UploadFailureCode, status: number | null): string {
    // `invalid_type` and `too_large` never reached the network; the rest map to
    // the specific recovery the user needs.
    if (code === 'cancelled') return ''
    if (
      code === 'invalid_type' ||
      code === 'too_large' ||
      code === 'rate_limited' ||
      code === 'upload_failed' ||
      code === 'upload_incomplete' ||
      code === 'image_rejected'
    ) {
      return t(code, { megabytes: MEGABYTES })
    }
    return errorMessage(null, status ?? undefined) ?? t('failed')
  }

  async function onPick(file: File) {
    setError(null)
    setSuccess(false)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const updated = await uploadProductImage({
        productId: product.id,
        file,
        signal: controller.signal,
        onPhase: setPhase,
        onProgress: setProgress,
      })
      setProduct(updated)
      setSuccess(true)
      // The RSC lists (admin table, catalog, product detail) render from
      // tag-cached fetches that the confirm handler already invalidated; this
      // pulls the new render into the current page.
      router.refresh()
    } catch (err) {
      const failure =
        err instanceof ProductImageUploadError
          ? err
          : new ProductImageUploadError('confirm_failed')
      const message = messageFor(failure.code, failure.status)
      if (message) setError(message)
    } finally {
      abortRef.current = null
      setPhase('idle')
      setProgress(0)
      // Always reset the input: re-picking the same file after a failure must
      // still fire `change`, and that is the documented fix for a 422.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /**
   * Abort and return to idle. Deliberately does not call confirm to "clean
   * up" — the partial object is referenced by nothing, and confirming it would
   * either 404 or publish a truncated file.
   */
  function cancel() {
    abortRef.current?.abort()
  }

  async function clearImage() {
    setConfirmingClear(false)
    setError(null)
    setSuccess(false)
    setClearing(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        // Clears the reference only; the stored object stays in the bucket.
        body: JSON.stringify({ imageUrl: null }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(data?.code, res.status) ?? t('failed'))
        return
      }
      setProduct((await res.json()) as ProductResponseDto)
      setSuccess(true)
      router.refresh()
    } catch {
      setError(t('failed'))
    } finally {
      setClearing(false)
      // The dialog restores focus to its trigger, but that button unmounts the
      // moment the image is gone — so focus would land on <body>. Send it to
      // the upload button, which is always present and is the logical next step.
      pickButtonRef.current?.focus()
    }
  }

  const percent = Math.round(progress * 100)

  // Phase only — never the percentage. This string sits in a polite live
  // region, and `upload.onprogress` fires many times a second: interpolating
  // the percent here makes a screen reader announce "Uploading 3%… 7%… 11%…"
  // for the whole upload. The number lives on the progressbar instead, which
  // assistive tech polls rather than announces.
  const statusLabel = clearing
    ? t('statusRemoving')
    : phase === 'minting'
      ? t('statusPreparing')
      : phase === 'uploading'
        ? t('statusUploadingPhase')
        : phase === 'confirming'
          ? t('statusFinishing')
          : null

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-fg">{t('title')}</h2>
        <p id={hintId} className="mt-1 text-sm text-fg-muted">
          {t('hint', { megabytes: MEGABYTES })}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex aspect-[4/3] w-full flex-none items-center justify-center overflow-hidden rounded-xl bg-brand-soft sm:w-56">
          <ProductImage
            // Never key on imageUrl: it changes on every replace, so keying
            // would remount the element on each upload for no benefit.
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            fallbackClassName="text-5xl opacity-80"
          />
          {/* The fallback glyph is aria-hidden, so without this the preview
              slot is silent. "No image" is meaningful state on this screen,
              unlike in the dense list views. */}
          {product.imageUrl ? null : (
            <span className="sr-only">{t('noImage')}</span>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <input
            ref={inputRef}
            type="file"
            // `sr-only` clips the input but leaves it focusable and in the
            // a11y tree, so a keyboard user would hit an unlabeled file
            // control and then the button that drives it. The button is the
            // affordance; take the input out of the tree entirely. (aria-hidden
            // without tabIndex=-1 would trip aria-hidden-focus.)
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            // A hint, not a guarantee — "all files" still lets anything
            // through, which is why `precheckProductImage` runs regardless.
            accept={PRODUCT_IMAGE_ACCEPT}
            disabled={busy || clearing}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onPick(file)
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              ref={pickButtonRef}
              type="button"
              className="btn-primary"
              disabled={busy || clearing}
              // Announce the format/size constraint before the picker opens,
              // rather than only after a rejected file.
              aria-describedby={hintId}
              onClick={() => inputRef.current?.click()}
            >
              {product.imageUrl ? t('replace') : t('upload')}
            </button>

            {cancellable ? (
              <button type="button" className="btn-ghost" onClick={cancel}>
                {t('cancel')}
              </button>
            ) : null}

            {canClear && product.imageUrl && !busy ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={clearing}
                onClick={() => setConfirmingClear(true)}
              >
                {t('clear')}
              </button>
            ) : null}
          </div>

          {statusLabel ? (
            <div role="status" aria-live="polite" className="space-y-1">
              <p className="text-sm text-fg-muted">
                {statusLabel}
                {phase === 'uploading' ? (
                  // Outside the announced text: the live region reads the
                  // phase, this span just updates on screen.
                  <span aria-hidden> {percent}%</span>
                ) : null}
              </p>
              {phase === 'uploading' ? (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={t('statusUploading', { percent })}
                  aria-label={t('progressLabel')}
                >
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              ) : null}
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

          {success && !busy ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl border border-forest-500/30 bg-forest-500/10 p-3 text-sm text-forest-700 dark:text-forest-300"
            >
              {t('success')}
            </p>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title={t('clear')}
        message={t('clearConfirm')}
        confirmLabel={t('clear')}
        danger
        onConfirm={() => void clearImage()}
        onCancel={() => setConfirmingClear(false)}
      />
    </section>
  )
}
