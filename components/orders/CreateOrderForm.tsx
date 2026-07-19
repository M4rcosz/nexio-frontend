'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatMoney, multiplyMoney, sumMoney } from '@/lib/money'
import { useIdempotencyKey } from '@/lib/orders/idempotency'
import {
  customerFields,
  getChannelPolicy,
  nameRequired,
  type CustomerIdentity,
} from '@/lib/orders/channelPolicy'
import { checkCustomerName } from '@/lib/validation/customerName'
import type { Order, OrderChannel, PublicMenuItem } from '@/lib/api/types'

type Selection = Record<string, number>

export type CreateOrderFormProps = {
  /** Drives which customer fields are shown/required (doc §3). */
  channel: OrderChannel
  businessUnitId: string
  products: PublicMenuItem[]
  loadingProducts?: boolean
  /** The menu request failed (distinct from a genuinely empty menu). */
  menuError?: boolean
  /** Retry the menu load; wired to the error state's retry action. */
  onReloadMenu?: () => void
  onPlaced: (order: Order) => void
  /** Kiosk (TOTEM) uses larger touch targets and hides the notes field. */
  variant?: 'default' | 'kiosk'
  /** TOTEM collects the name up front; pass it here so the field is not shown
   * twice. When omitted, the form renders its own name field. */
  presetName?: string
}

export function CreateOrderForm({
  channel,
  businessUnitId,
  products,
  loadingProducts = false,
  menuError = false,
  onReloadMenu,
  onPlaced,
  variant = 'default',
  presetName,
}: CreateOrderFormProps) {
  const t = useTranslations('createOrder')
  const tValidation = useTranslations('createOrder.validation')
  const errorMessage = useErrorMessage()
  const locale = useLocale()

  const policy = getChannelPolicy(channel)
  const kiosk = variant === 'kiosk'

  // Collision-safe ids so two form instances on one surface can't clash.
  const customerIdInputId = useId()
  const notesId = useId()

  const [selection, setSelection] = useState<Selection>({})
  // COUNTER/PICKUP only: look up a registered customer vs a walk-in name.
  const [identityMode, setIdentityMode] = useState<'account' | 'name'>('name')
  const [customerId, setCustomerId] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitting, start] = useTransition()

  const name = presetName ?? nameInput
  const usingAccount = policy.allowsCustomerId && identityMode === 'account'

  const orderItems = useMemo(
    () =>
      products
        .filter((p) => (selection[p.productId] ?? 0) > 0)
        .map((p) => ({
          productId: p.productId,
          quantity: selection[p.productId],
          unitPrice: p.price,
        })),
    [products, selection],
  )

  const estimatedTotal = useMemo(
    () =>
      sumMoney(orderItems.map((i) => multiplyMoney(i.unitPrice, i.quantity))),
    [orderItems],
  )

  // Assemble the customer identity so `customerId` and `customerName` can never
  // both be set (customerFields enforces it structurally).
  const identity: CustomerIdentity = usingAccount
    ? { kind: 'account', customerId: customerId.trim() }
    : nameRequired(channel, false) || name.trim() !== ''
      ? { kind: 'name', customerName: name.trim() }
      : { kind: 'jwt' }

  const payload = useMemo(
    () => ({
      businessUnitId,
      orderChannel: channel,
      ...customerFields(identity),
      orderItems,
      notes: notes.trim() || undefined,
    }),
    // identity is derived from customerId/name/mode; list those instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      businessUnitId,
      channel,
      customerId,
      name,
      usingAccount,
      orderItems,
      notes,
    ],
  )

  const idempotencyKey = useIdempotencyKey(payload)

  function setQuantity(productId: string, quantity: number) {
    setSelection((s) => {
      const next = { ...s }
      if (quantity <= 0) delete next[productId]
      else next[productId] = quantity
      return next
    })
  }

  function validate(): boolean {
    setNameError(null)
    setError(null)
    if (orderItems.length === 0) {
      setError(t('noItems'))
      return false
    }
    // Client-side prevention of the known 422s (doc §3/§11): a required or
    // provided name must be well-formed; a registered lookup needs an id.
    const needName = nameRequired(
      channel,
      usingAccount && customerId.trim() !== '',
    )
    if (usingAccount) {
      if (customerId.trim() === '') {
        setError(t('customerIdRequired'))
        return false
      }
    } else if (needName || name.trim() !== '') {
      const rule = checkCustomerName(name)
      if (rule) {
        setNameError(
          rule === 'too-long'
            ? tValidation('nameTooLong')
            : tValidation('nameRequired'),
        )
        return false
      }
    }
    return true
  }

  function submit() {
    if (!validate()) return
    start(async () => {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            code?: string
          } | null
          // A 401 means the device's staff session expired mid-order. Surface
          // the re-auth hint (as CheckoutView special-cases 401) instead of the
          // generic failure, so the attendant knows to sign back in rather than
          // just retrying a doomed submission.
          const message =
            res.status === 401
              ? (errorMessage(undefined, 401) ?? t('submitFailed'))
              : (errorMessage(body?.code, res.status) ?? t('submitFailed'))
          setError(message)
          return
        }
        const order = (await res.json()) as Order
        onPlaced(order)
      } catch {
        setError(t('submitFailed'))
      }
    })
  }

  const labelClass = kiosk
    ? 'text-sm font-mono uppercase tracking-widest text-fg-subtle'
    : 'text-[11px] font-mono uppercase tracking-widest text-fg-subtle'

  return (
    <div className="space-y-4">
      {/* Customer identity — only where the channel needs it. */}
      {policy.allowsCustomerId ? (
        <section className="card p-5">
          <p className={labelClass}>{t('customerSection')}</p>
          <IdentityRadioGroup
            value={identityMode}
            onChange={setIdentityMode}
            kiosk={kiosk}
            label={t('customerSection')}
            options={[
              { value: 'name', label: t('walkIn') },
              { value: 'account', label: t('lookupCustomer') },
            ]}
          />
          {usingAccount ? (
            <div className="mt-3">
              <label className="label" htmlFor={customerIdInputId}>
                {t('customerId')}
              </label>
              <input
                id={customerIdInputId}
                className="input"
                placeholder={t('customerIdPlaceholder')}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              />
            </div>
          ) : (
            <NameField
              value={nameInput}
              onChange={setNameInput}
              error={nameError}
              label={t('walkInName')}
              placeholder={t('walkInNamePlaceholder')}
              kiosk={kiosk}
            />
          )}
        </section>
      ) : null}

      {/* TOTEM (and any name-only channel): the name field, unless the host
          flow already collected it (presetName). */}
      {!policy.allowsCustomerId &&
      !policy.nameRejected &&
      presetName === undefined ? (
        <section className="card p-5">
          <p className={labelClass}>{t('customerSection')}</p>
          <NameField
            value={nameInput}
            onChange={setNameInput}
            error={nameError}
            label={t('walkInName')}
            placeholder={t('walkInNamePlaceholder')}
            kiosk={kiosk}
          />
        </section>
      ) : null}

      {/* Product picker. */}
      <section className="card overflow-hidden p-0">
        <div className="border-b border-border p-5">
          <p className={labelClass}>{t('itemsTitle')}</p>
        </div>
        {loadingProducts ? (
          <p className="p-6 text-sm text-fg-muted">{t('loadingProducts')}</p>
        ) : menuError ? (
          <div
            role="alert"
            className="m-5 rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
          >
            <p>{t('menuLoadError')}</p>
            {onReloadMenu ? (
              <button
                type="button"
                onClick={onReloadMenu}
                className="btn-ghost mt-2 !py-1.5 text-xs"
              >
                {t('retry')}
              </button>
            ) : null}
          </div>
        ) : products.length === 0 ? (
          <p className="p-6 text-sm text-fg-muted">{t('emptyMenu')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((p) => {
              const qty = selection[p.productId] ?? 0
              return (
                <li
                  key={p.productId}
                  className={`flex items-center justify-between gap-3 px-5 ${kiosk ? 'py-4' : 'py-3'}`}
                >
                  <div className="min-w-0">
                    <p
                      className={`font-medium text-fg ${kiosk ? 'text-lg' : 'text-sm'}`}
                    >
                      {p.name}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {formatMoney(p.price, locale)}
                    </p>
                  </div>
                  <Stepper
                    value={qty}
                    onChange={(v) => setQuantity(p.productId, v)}
                    kiosk={kiosk}
                    decrementLabel={t('decrement')}
                    incrementLabel={t('increment')}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {!kiosk ? (
        <section className="card p-5">
          <label className="label" htmlFor={notesId}>
            {t('notesLabel')}
          </label>
          <textarea
            id={notesId}
            className="input min-h-[72px]"
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          {/* Client-side estimate only; the backend computes the authoritative
              total (a promotion/loyalty adjustment can change it), so label it
              "Estimated total" — matching CheckoutView's convention. */}
          <p className={labelClass}>{t('estimatedTotal')}</p>
          <p
            className={`font-display font-bold text-gradient-brand ${kiosk ? 'text-4xl' : 'text-2xl'}`}
          >
            {formatMoney(estimatedTotal, locale)}
          </p>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || orderItems.length === 0}
          className={`btn-primary ${kiosk ? 'px-8 py-4 text-lg' : ''}`}
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  )
}

function NameField({
  value,
  onChange,
  error,
  label,
  placeholder,
  kiosk,
}: {
  value: string
  onChange: (v: string) => void
  error: string | null
  label: string
  placeholder: string
  kiosk: boolean
}) {
  const inputId = useId()
  const errorId = useId()
  return (
    <div className="mt-3">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`input ${kiosk ? 'text-xl' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-accent-600 dark:text-accent-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Mutually exclusive walk-in / registered-customer choice as a proper
 * radiogroup (arrow keys move between options, roving tabindex), rather than two
 * independent toggle buttons — the options are exclusive, so a radiogroup is the
 * correct semantics.
 */
function IdentityRadioGroup({
  value,
  onChange,
  kiosk,
  label,
  options,
}: {
  value: 'account' | 'name'
  onChange: (v: 'account' | 'name') => void
  kiosk: boolean
  label: string
  options: { value: 'account' | 'name'; label: string }[]
}) {
  function move(delta: number) {
    const idx = options.findIndex((o) => o.value === value)
    const next = (idx + delta + options.length) % options.length
    onChange(options[next].value)
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mt-3 flex gap-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-3 ${kiosk ? 'py-3 text-base' : 'py-2 text-sm'} font-medium transition-colors ${
              active
                ? 'border-brand-500/40 bg-brand-gradient text-white shadow-soft'
                : 'border-border text-fg-muted hover:bg-surface-2 hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Stepper({
  value,
  onChange,
  kiosk,
  decrementLabel,
  incrementLabel,
}: {
  value: number
  onChange: (v: number) => void
  kiosk: boolean
  decrementLabel: string
  incrementLabel: string
}) {
  const size = kiosk ? 'h-12 w-12 text-2xl' : 'h-8 w-8 text-lg'
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className={`flex ${size} items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40`}
      >
        −
      </button>
      <span
        className={`w-8 text-center font-mono ${kiosk ? 'text-xl' : 'text-sm'} tabular-nums text-fg`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
        className={`flex ${size} items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40`}
      >
        +
      </button>
    </div>
  )
}
