import { useTranslations } from 'next-intl'

export function StubBadge() {
  const t = useTranslations('common')
  return (
    <span title={t('stubTitle')} className="chip-warn">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulse" />
      {t('stub')}
    </span>
  )
}

export function BackendBadge() {
  const t = useTranslations('common')
  return (
    <span title={t('backendBadgeTitle')} className="chip-success">
      <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
      {t('backendBadge')}
    </span>
  )
}
