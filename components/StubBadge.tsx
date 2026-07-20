import { useTranslations } from 'next-intl'

// These badges annotate which sections run on real backend endpoints vs. mock
// data — a scaffolding signal for developers during the mock→backend migration,
// not something customers should see. Hidden in production builds. Note: Vercel
// preview deployments build with NODE_ENV=production too, so they're hidden
// there as well; expose NEXT_PUBLIC_VERCEL_ENV and check it here if you want
// them kept on previews.
const showDevBadges = process.env.NODE_ENV !== 'production'

export function StubBadge() {
  const t = useTranslations('common')
  if (!showDevBadges) return null
  return (
    <span title={t('stubTitle')} className="chip-warn">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-500 animate-pulse" />
      {t('stub')}
    </span>
  )
}

export function BackendBadge() {
  const t = useTranslations('common')
  if (!showDevBadges) return null
  return (
    <span title={t('backendBadgeTitle')} className="chip-success">
      <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
      {t('backendBadge')}
    </span>
  )
}
