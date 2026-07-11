'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import type { LoyaltyAccount, LoyaltyTransactionType } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'

/**
 * `initial` is null while the loyalty account does not exist yet — the
 * backend creates it on the first order or when consent is granted.
 */
export function LoyaltyView({ initial }: { initial: LoyaltyAccount | null }) {
  const [account, setAccount] = useState<LoyaltyAccount | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const t = useTranslations('loyalty')
  const errorMessage = useErrorMessage()
  const locale = useLocale()

  const TX_LABEL: Record<LoyaltyTransactionType, string> = {
    EARN: t('txEarn'),
    REDEEM: t('txRedeem'),
    EXPIRE: t('txExpire'),
    ADJUSTMENT: t('txAdjustment'),
  }

  function consent() {
    setError(null)
    start(async () => {
      const res = await fetch('/api/loyalty/me/consent', { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('consentFailed'))
        return
      }
      setAccount((await res.json()) as LoyaltyAccount)
    })
  }

  function revokeConsent() {
    setError(null)
    start(async () => {
      const res = await fetch('/api/loyalty/me/consent', { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('consentFailed'))
        return
      }
      setAccount((await res.json()) as LoyaltyAccount)
    })
  }

  const transactions = account?.transactions ?? []

  return (
    <div className="grid gap-5 md:grid-cols-3">
      <section className="relative overflow-hidden md:col-span-2">
        <div className="card relative overflow-hidden p-7">
          <div
            className="grain pointer-events-none absolute inset-0 bg-brand-gradient opacity-15"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
              {t('balance')}
            </p>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="font-display text-6xl font-extrabold text-gradient-brand">
                {account?.totalPoints ?? 0}
              </span>
              <span className="text-sm font-medium text-fg-muted">
                {t('points')}
              </span>
            </p>

            <h3 className="mt-8 text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
              {t('history')}
            </h3>
            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-fg-muted">{t('noHistory')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-start justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-fg">{tx.description}</p>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        {TX_LABEL[tx.type]} ·{' '}
                        {formatDateTime(tx.createdAt, locale)}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        tx.type === 'EARN'
                          ? 'text-forest-500'
                          : 'text-accent-500'
                      }`}
                    >
                      {tx.type === 'EARN' ? '+' : '−'}
                      {tx.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card h-max p-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
          {t('consentTitle')}
        </p>
        {account?.consentGiven ? (
          <>
            <p className="mt-3 flex items-start gap-2 text-sm text-forest-500">
              <CheckCircle className="h-4 w-4 flex-none mt-0.5" />
              {t('consentGivenAt', {
                date: account.consentDate
                  ? formatDateTime(account.consentDate, locale)
                  : '',
              })}
            </p>
            <p className="mt-3 text-xs text-fg-subtle">
              {t('consentRevocation')}
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-accent-500/30 bg-accent-500/10 p-2 text-xs text-accent-700 dark:text-accent-300"
              >
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={revokeConsent}
              disabled={pending}
              className="btn-secondary mt-4 w-full"
            >
              {pending ? t('consentSubmitting') : t('consentRevoke')}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-fg-muted leading-relaxed">
              {t('consentText')}
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-accent-500/30 bg-accent-500/10 p-2 text-xs text-accent-700 dark:text-accent-300"
              >
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={consent}
              disabled={pending}
              className="btn-primary mt-4 w-full"
            >
              {pending ? t('consentSubmitting') : t('consentSubmit')}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

function CheckCircle({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  )
}
