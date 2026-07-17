'use client'

import { useTranslations } from 'next-intl'
import { scorePassword } from '@/lib/validation/password'

/**
 * Visual strength meter driven by the shared {@link scorePassword} scorer, so it
 * can never disagree with the strong-password schema. Renders four segments (one
 * per character class) and a label; turns positive only once the 3-of-4 + length
 * rule is met.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations('password')
  const { classes, valid } = scorePassword(password)

  // Empty field: show the requirement hint, no bar.
  if (password.length === 0) {
    return <p className="mt-1 text-xs text-fg-subtle">{t('requirement')}</p>
  }

  const label = valid
    ? classes >= 4
      ? t('strengthStrong')
      : t('strengthGood')
    : classes >= 2
      ? t('strengthFair')
      : t('strengthWeak')

  const barColor = valid
    ? 'bg-forest-500'
    : classes >= 2
      ? 'bg-amber-500'
      : 'bg-accent-500'

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < classes ? barColor : 'bg-surface-2'
            }`}
          />
        ))}
      </div>
      <p
        className={`mt-1 text-xs ${valid ? 'text-forest-700 dark:text-forest-300' : 'text-fg-muted'}`}
        role="status"
        aria-live="polite"
      >
        {t('strengthLabel')}: {label}
      </p>
      {!valid ? (
        <p className="mt-1 text-xs text-fg-subtle">{t('requirement')}</p>
      ) : null}
    </div>
  )
}
