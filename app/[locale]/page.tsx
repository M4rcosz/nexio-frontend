import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { listBusinessUnits } from '@/lib/api/business-units'
import { StubBadge } from '@/components/StubBadge'
import { SetBusinessUnitButton } from '@/components/SetBusinessUnitButton'
import { HomeProductSearch } from '@/components/HomeProductSearch'
import { getTenant } from '@/lib/tenant/resolve'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('home')
  const tenant = await getTenant()
  const { data } = await listBusinessUnits()
  const defaultUnitId = data[0]?.id ?? null

  return (
    <div className="space-y-12">
      {/* Hero ----------------------------------------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-bg-elevated">
        <div
          className="grain absolute inset-0 bg-brand-gradient"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/40" aria-hidden />
        <div className="relative px-5 py-10 sm:px-12 sm:py-20 lg:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {tenant.name}
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-white sm:mt-5 sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:mt-5 sm:text-lg">
            {t('heroSubtitle')}
          </p>

          {/* Global product search */}
          <div className="mt-6 sm:mt-8">
            <HomeProductSearch defaultUnitId={defaultUnitId} />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#units"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 shadow-soft-lg transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-3"
            >
              {t('chooseUnit')}
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Units ---------------------------------------------------------- */}
      <section id="units" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
              {t('chooseUnit')}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {data.length} {data.length === 1 ? 'unit' : 'units'}
            </p>
          </div>
          <StubBadge />
        </div>

        <ul className="grid gap-5 sm:grid-cols-2">
          {data.map((unit, i) => (
            <li key={unit.id}>
              <article className="card card-hover group flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
                      0{i + 1} · {unit.city}
                    </span>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-fg">
                      {unit.name}
                    </h3>
                  </div>
                  <span className="chip-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
                    open
                  </span>
                </div>
                <dl className="mt-4 space-y-2 text-sm text-fg-muted">
                  <div className="flex items-start gap-2">
                    <PinIcon className="mt-0.5 h-4 w-4 flex-none text-brand-500" />
                    <dd>{unit.address}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="h-4 w-4 flex-none text-brand-500" />
                    <dd>{unit.phone}</dd>
                  </div>
                </dl>
                <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
                  <Link
                    href={`/units/${unit.id}`}
                    className="btn-primary flex-1"
                  >
                    {t('viewMenu')}
                  </Link>
                  <SetBusinessUnitButton id={unit.id} name={unit.name} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ArrowDown({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  )
}

function PinIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72a2 2 0 0 1 1.72 2z" />
    </svg>
  )
}
