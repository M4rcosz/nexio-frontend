'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatMoney } from '@/lib/money'
import { shortOrderRef } from '@/lib/orders/orderRef'
import { checkCustomerName } from '@/lib/validation/customerName'
import { CreateOrderForm } from './CreateOrderForm'
import type { Order, PublicBusinessUnit, PublicMenuItem } from '@/lib/api/types'

type Step = 'welcome' | 'name' | 'order' | 'placed'

/**
 * Self-service kiosk flow (channel TOTEM). Large touch targets, no navigation.
 * The name is always required for this channel, so it is prompted first (doc §3
 * — "nome para chamar o pedido"), then the item picker, then a confirmation
 * with the order number to call.
 */
export function TotemFlow({
  unit,
  products,
}: {
  unit: PublicBusinessUnit
  products: PublicMenuItem[]
}) {
  const t = useTranslations('totem')
  const tValidation = useTranslations('createOrder.validation')
  const locale = useLocale()

  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<Order | null>(null)
  const nameErrorId = useId()

  // Move focus to the new step's heading on each transition so keyboard/AT users
  // land somewhere sensible instead of on the previous (now unmounted) control.
  // The name step focuses its input directly, so it opts out here.
  const welcomeHeadingRef = useRef<HTMLParagraphElement>(null)
  const orderHeadingRef = useRef<HTMLParagraphElement>(null)
  const placedHeadingRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (step === 'welcome') welcomeHeadingRef.current?.focus()
    else if (step === 'order') orderHeadingRef.current?.focus()
    else if (step === 'placed') placedHeadingRef.current?.focus()
  }, [step])

  function reset() {
    setName('')
    setNameError(null)
    setPlaced(null)
    setStep('welcome')
  }

  function confirmName() {
    const rule = checkCustomerName(name)
    if (rule) {
      setNameError(
        rule === 'too-long'
          ? tValidation('nameTooLong')
          : tValidation('nameRequired'),
      )
      return
    }
    setNameError(null)
    setStep('order')
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
      {step === 'welcome' ? (
        <div className="card space-y-6 p-10 text-center">
          <p
            ref={welcomeHeadingRef}
            tabIndex={-1}
            className="font-display text-4xl font-extrabold tracking-tight text-fg outline-none"
          >
            {t('welcome')}
          </p>
          <p className="text-lg text-fg-muted">{unit.name}</p>
          <button
            type="button"
            className="btn-primary px-10 py-5 text-xl"
            onClick={() => setStep('name')}
          >
            {t('start')}
          </button>
        </div>
      ) : null}

      {step === 'name' ? (
        <div className="card space-y-5 p-10">
          <label
            className="block font-display text-2xl font-bold text-fg"
            htmlFor="totemName"
          >
            {t('namePrompt')}
          </label>
          <input
            id="totemName"
            className="input text-2xl"
            placeholder={t('namePlaceholder')}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmName()
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
          />
          {nameError ? (
            <p
              id={nameErrorId}
              role="alert"
              className="text-sm text-accent-600 dark:text-accent-400"
            >
              {nameError}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-ghost px-6 py-4 text-lg"
              onClick={reset}
            >
              {t('back')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1 px-8 py-4 text-lg"
              onClick={confirmName}
            >
              {t('continue')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'order' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p
              ref={orderHeadingRef}
              tabIndex={-1}
              className="font-display text-2xl font-bold text-fg outline-none"
            >
              {t('chooseItems')}
            </p>
            <span className="chip text-base">{name.trim()}</span>
          </div>
          <CreateOrderForm
            channel="TOTEM"
            businessUnitId={unit.id}
            products={products}
            variant="kiosk"
            presetName={name.trim()}
            onPlaced={(order) => {
              setPlaced(order)
              setStep('placed')
            }}
          />
          <button
            type="button"
            className="btn-ghost w-full py-3"
            onClick={reset}
          >
            {t('cancel')}
          </button>
        </div>
      ) : null}

      {step === 'placed' && placed ? (
        <div className="card space-y-6 p-10 text-center">
          <span className="text-6xl" aria-hidden>
            🎉
          </span>
          <p
            ref={placedHeadingRef}
            tabIndex={-1}
            className="font-display text-3xl font-extrabold text-fg outline-none"
          >
            {t('orderPlaced', { name: placed.customerName ?? name.trim() })}
          </p>
          <div>
            {/* The name in the heading above is the call-token; the raw id is
                only a muted, secondary reference (no friendly number exists). */}
            <p className="font-mono text-xs text-fg-subtle">
              {t('orderRef', { ref: shortOrderRef(placed.id) })}
            </p>
            <p className="mt-3 font-display text-3xl font-bold text-gradient-brand">
              {formatMoney(placed.totalAmount, locale)}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary px-10 py-5 text-xl"
            onClick={reset}
          >
            {t('newOrder')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
