import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAdminContext } from '@/lib/auth/access'
import { USE_MOCKS } from '@/lib/api/client'
import { isWorkflowConfigured, listWorkflows } from '@/lib/api/workflow'
import {
  clampWorkflowPaging,
  parseWorkflowOffset,
} from '@/lib/api/workflow/paging'
import { WorkflowList } from '@/components/admin/workflow/WorkflowList'
import { WorkflowOffsetPager } from '@/components/admin/workflow/WorkflowOffsetPager'

export const dynamic = 'force-dynamic'

/**
 * The workflow definitions, read-only apart from the enabled toggle.
 *
 * ADMIN only, enforced here *and* in the route handler the toggle posts to: a
 * workflow calls arbitrary third parties with stored credentials, so it is not a
 * MANAGER's to start or stop. `shellTier()` puts `/admin/*` on the `full` tier
 * but gates nothing — the role check is what hides the screen.
 */
export default async function AdminWorkflowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ offset?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  if (ctx.role !== 'ADMIN') notFound()

  const [t, sp] = await Promise.all([
    getTranslations('admin.workflows'),
    searchParams,
  ])

  // An unset `WORKFLOW_INTERNAL_URL` is a supported configuration, not a fault
  // (`lib/env.ts` keeps it optional), so this renders a calm empty state rather
  // than an error card. A mock build needs no URL at all.
  const configured = USE_MOCKS || isWorkflowConfigured()

  // Clamped before the read: §2.6 answers `BAD_REQUEST` outside 1–100 / 0–10000,
  // and a stale pager link should land on a page, not on an error.
  const paging = clampWorkflowPaging({ offset: parseWorkflowOffset(sp.offset) })
  const workflows = configured ? await listWorkflows(paging) : []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      {!configured ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🔌
          </span>
          <h2 className="font-medium text-fg">{t('notConfiguredTitle')}</h2>
          {/* Prose keeps its own cap on the uncapped `full` tier. */}
          <p className="max-w-prose text-sm text-fg-muted">
            {t('notConfiguredBody')}
          </p>
        </div>
      ) : (
        <>
          {/* `workflows` is a bare array with no total (§4), so an offset past
              the end is indistinguishable from an empty collection until the
              page comes back empty. Say which one it is — and drop the count,
              which would otherwise read "no workflows" on a stale link. */}
          {workflows.length === 0 && paging.offset > 0 ? (
            <p className="card p-12 text-center text-sm text-fg-muted">
              {t('emptyPage')}
            </p>
          ) : (
            <>
              <p className="text-xs text-fg-subtle">
                {t('count', { count: workflows.length })}
              </p>
              <WorkflowList workflows={workflows} />
            </>
          )}

          <WorkflowOffsetPager
            basePath="/admin/workflows"
            paging={paging}
            itemCount={workflows.length}
          />
        </>
      )}
    </div>
  )
}
