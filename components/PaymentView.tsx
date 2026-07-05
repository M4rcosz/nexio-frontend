'use client'

import { useEffect, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { Link } from '@/i18n/navigation'
import { formatMoney } from '@/lib/money'
import type { Payment, PaymentMethod, PaymentStatus } from '@/lib/api/types'

const METHODS: PaymentMethod[] = ['PIX', 'CREDIT_CARD']

const STATUS_CHIP: Record<PaymentStatus, string> = {
  PENDING: 'chip-warn',
  PROCESSING: 'chip-warn',
  APPROVED: 'chip-success',
  REFUSED: 'chip-warn',
  CANCELLED: 'chip',
  REFUNDED: 'chip',
}

export function PaymentView({
  orderId,
  amount,
}: {
  orderId: string
  amount: string
}) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const t = useTranslations('payment')
  const errorMessage = useErrorMessage()
  const tMethod = useTranslations('paymentMethod')
  const tStatus = useTranslations('paymentStatus')
  const locale = useLocale()

  useEffect(() => {
    let cancelled = false
    async function tick() {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        cache: 'no-store',
      })
      if (res.status === 404) return
      if (!res.ok) return
      const body = (await res.json()) as Payment
      if (!cancelled) setPayment(body)
    }
    tick()
    const interval = setInterval(tick, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [orderId])

  function startPayment() {
    setError(null)
    start(async () => {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null
        setError(errorMessage(body?.code, res.status) ?? t('failed'))
        return
      }
      setPayment((await res.json()) as Payment)
    })
  }

  if (payment) {
    const isApproved = payment.status === 'APPROVED'
    return (
      <div className="card overflow-hidden p-0">
        <div className="border-b border-border bg-surface-2 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
                {t('methodTitle')}
              </p>
              <p className="mt-1 text-base font-semibold text-fg">
                {tMethod(payment.method)}
              </p>
            </div>
            <span className={STATUS_CHIP[payment.status]}>
              <span className={`h-1.5 w-1.5 rounded-full ${isApproved ? 'bg-forest-500' : 'bg-accent-500 animate-pulse'}`} />
              {tStatus(payment.status)}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {payment.method === 'PIX' && payment.pixCode ? (
            <div>
              <p className="label">{t('pix')}</p>
              <textarea
                readOnly
                onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
                className="input min-h-[110px] font-mono text-xs"
                value={payment.pixCode}
              />
              <p className="mt-2 text-xs text-fg-subtle">{t('pixDisclaimer')}</p>
            </div>
          ) : null}

          {isApproved ? (
            <Link
              href={`/orders/${orderId}`}
              className="btn-primary w-full"
            >
              {t('trackOrder')} →
            </Link>
          ) : (
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              {t('waiting')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
          {t('totalLabel')}
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-gradient-brand">
          {formatMoney(amount, locale)}
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="label">{t('methodLabel')}</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                  method === m
                    ? 'border-brand-500 bg-brand-gradient text-white shadow-glow'
                    : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg'
                }`}
              >
                {m === 'PIX' ? <PixIcon className="h-4 w-4" /> : <CardIcon className="h-4 w-4" />}
                {tMethod(m)}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm text-accent-700 dark:text-accent-300">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={startPayment}
          disabled={pending}
          className="btn-primary w-full"
        >
          {pending ? t('paying') : t('pay')}
        </button>
      </div>
    </div>
  )
}

function CardIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function PixIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m12 2 4 4-4 4-4-4z" />
      <path d="m18 8 4 4-4 4-4-4z" />
      <path d="m6 8 4 4-4 4-4-4z" />
      <path d="m12 14 4 4-4 4-4-4z" />
    </svg>
  )
}
