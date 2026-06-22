import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('errors')
  return (
    <div className="card mx-auto max-w-xl p-10 text-center">
      <p className="font-display text-7xl font-extrabold text-gradient-brand">
        404
      </p>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-fg">
        {t('notFoundTitle')}
      </h2>
      <p className="mt-2 text-sm text-fg-muted">{t('notFoundBody')}</p>
      <Link href="/" className="btn-primary mt-6 inline-flex">
        {t('notFoundHome')}
      </Link>
    </div>
  )
}
