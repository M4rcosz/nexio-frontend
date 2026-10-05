import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getAdminContext } from '@/lib/auth/access'
import { USE_MOCKS } from '@/lib/api/client'
import { getWorkflow, isWorkflowConfigured } from '@/lib/api/workflow'
import type { JsonObject } from '@/lib/api/workflow/types'
import { NodeSummaryList } from '@/components/admin/workflow/NodeSummaryList'
import { WorkflowStatusBadge } from '@/components/admin/workflow/WorkflowStatusBadge'
import { WorkflowToggle } from '@/components/admin/workflow/WorkflowToggle'
import { formatDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

/** A `JSON` scalar entry, only when it is a usable non-empty string. */
function configString(config: JsonObject | null, key: string): string | null {
  const value = config?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * One definition: its metadata, how it is triggered and the graph it runs.
 *
 * The run history is deliberately absent — that section is Phase 2. When it
 * lands, note that `listExecutions` throws `NOT_FOUND` for an unknown workflow
 * but returns `[]` for one that was simply never triggered (§4). Only the first
 * is a 404, and it is already handled here by `getWorkflow` returning `null`
 * *before* any run is fetched; an empty array must render an empty state, never
 * `notFound()`.
 */
export default async function AdminWorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { id, locale } = await params
  setRequestLocale(locale)
  const ctx = await getAdminContext()
  if (!ctx) return null
  // ADMIN only, same as the list and the toggle's route handler.
  if (ctx.role !== 'ADMIN') notFound()

  const t = await getTranslations('admin.workflows')

  // An unset service URL is a supported configuration, not a fault — the calm
  // state, not an error card (and not a 404: the workflow may well exist).
  if (!USE_MOCKS && !isWorkflowConfigured()) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/workflows"
          className="text-sm font-medium text-fg-muted hover:text-brand-500"
        >
          {t('detail.back')}
        </Link>
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <span className="text-5xl" aria-hidden>
            🔌
          </span>
          <h1 className="font-medium text-fg">{t('notConfiguredTitle')}</h1>
          <p className="max-w-prose text-sm text-fg-muted">
            {t('notConfiguredBody')}
          </p>
        </div>
      </div>
    )
  }

  const workflow = await getWorkflow(id)
  if (!workflow) notFound()

  const config = workflow.trigger.config ?? null
  const cron = configString(config, 'cron')
  const event = configString(config, 'event')
  const triggerLabel =
    workflow.trigger.type === 'SCHEDULE'
      ? t('triggerSchedule')
      : t('triggerMockEvent')

  return (
    <div className="space-y-6">
      <Link
        href="/admin/workflows"
        className="text-sm font-medium text-fg-muted hover:text-brand-500"
      >
        {t('detail.back')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {workflow.name}
          </h1>
          {/* A description is prose, so it keeps its own cap on the `full`
              tier regardless of how wide the shell is. */}
          <p className="mt-1 max-w-prose text-sm text-fg-muted">
            {workflow.description ?? t('detail.noDescription')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WorkflowStatusBadge enabled={workflow.enabled} />
          <WorkflowToggle
            id={workflow.id}
            enabled={workflow.enabled}
            className="btn-secondary text-sm"
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('detail.sectionOverview')}
          </h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-[9rem_1fr]">
            <dt className="text-fg-subtle">{t('detail.fieldId')}</dt>
            <dd className="min-w-0">
              <code className="block truncate font-mono text-fg">
                {workflow.id}
              </code>
            </dd>
            <dt className="text-fg-subtle">{t('detail.fieldStartNode')}</dt>
            <dd className="min-w-0">
              {workflow.startNodeId ? (
                <code className="block truncate font-mono text-fg">
                  {workflow.startNodeId}
                </code>
              ) : (
                <span className="text-accent-700 dark:text-accent-300">
                  {t('detail.fieldStartNodeMissing')}
                </span>
              )}
            </dd>
            <dt className="text-fg-subtle">{t('detail.fieldCreated')}</dt>
            <dd className="text-fg">
              {formatDateTime(workflow.createdAt, locale)}
            </dd>
            <dt className="text-fg-subtle">{t('detail.fieldUpdated')}</dt>
            <dd className="text-fg">
              {formatDateTime(workflow.updatedAt, locale)}
            </dd>
          </dl>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('detail.sectionTrigger')}
          </h2>
          <dl className="grid gap-2 text-xs sm:grid-cols-[9rem_1fr]">
            <dt className="text-fg-subtle">{t('detail.fieldTriggerType')}</dt>
            <dd className="text-fg">{triggerLabel}</dd>
            {event ? (
              <>
                <dt className="text-fg-subtle">{t('triggerEventLabel')}</dt>
                <dd className="min-w-0">
                  <code className="block truncate font-mono text-fg">
                    {event}
                  </code>
                </dd>
              </>
            ) : null}
            {cron ? (
              <>
                <dt className="text-fg-subtle">{t('triggerCronLabel')}</dt>
                <dd className="min-w-0">
                  {/* Shown raw: six fields with seconds first (§11) is not
                      something to paraphrase for whoever wrote it. */}
                  <code className="block break-all font-mono text-fg">
                    {cron}
                  </code>
                  <p className="mt-0.5 text-fg-subtle">
                    {t('triggerCronHint')}
                  </p>
                </dd>
              </>
            ) : null}
            {!event && !cron ? (
              <>
                <dt className="text-fg-subtle">{t('triggerEventLabel')}</dt>
                <dd className="text-fg-subtle">{t('triggerUnknown')}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
          {t('detail.sectionNodes')} ·{' '}
          {t('nodeCount', { count: workflow.nodes.length })}
        </h2>
        <NodeSummaryList
          nodes={workflow.nodes}
          startNodeId={workflow.startNodeId}
        />
      </section>
    </div>
  )
}
