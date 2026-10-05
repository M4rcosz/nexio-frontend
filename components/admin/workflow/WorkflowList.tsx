'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { formatDateTime } from '@/lib/format'
import type { WorkflowDefinition } from '@/lib/api/workflow/types'
import { WorkflowStatusBadge } from './WorkflowStatusBadge'
import { WorkflowToggle } from './WorkflowToggle'

/**
 * The definition list: mobile cards below `md`, a data table above it — the
 * `PromotionList` shape, because an operator reads these the same way.
 *
 * The list read asks for `nodes { id }` and nothing else, so only a *count* is
 * available here. That is deliberate: pulling `headers`/`body`/`config` for
 * every node of every row would multiply a third party's JSON by the page size
 * (see `lib/api/workflow/documents.ts`).
 */
export function WorkflowList({
  workflows,
}: {
  workflows: WorkflowDefinition[]
}) {
  const t = useTranslations('admin.workflows')
  const locale = useLocale()

  if (workflows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="text-5xl" aria-hidden>
          ⚙️
        </span>
        <p className="text-fg-muted">{t('empty')}</p>
      </div>
    )
  }

  /**
   * "Event · order.confirmed" / "Schedule · 0 0 8 * * MON-FRI". The cron is
   * shown raw rather than described in prose: six fields with seconds first
   * (§11) is not something to paraphrase for an operator who wrote it.
   *
   * `config` is typed as an object but comes from a `JSON` scalar, so it is
   * defended against `null` here rather than through
   * `lib/api/workflow/graphql`'s `asJsonObject` — that module is the server
   * transport and must not be pulled into the client bundle.
   */
  function triggerLabel(workflow: WorkflowDefinition): string {
    const config = workflow.trigger.config ?? {}
    const detail =
      workflow.trigger.type === 'SCHEDULE' ? config.cron : config.event
    const kind =
      workflow.trigger.type === 'SCHEDULE'
        ? t('triggerSchedule')
        : t('triggerMockEvent')
    return typeof detail === 'string' && detail !== ''
      ? `${kind} · ${detail}`
      : kind
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="grid gap-3 md:hidden">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/workflows/${workflow.id}`}
                className="font-medium text-fg hover:text-brand-500"
              >
                {workflow.name}
              </Link>
              <WorkflowStatusBadge enabled={workflow.enabled} />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-fg-muted">
              <span className="truncate" title={triggerLabel(workflow)}>
                {triggerLabel(workflow)}
              </span>
              <span>{t('nodeCount', { count: workflow.nodes.length })}</span>
              <span className="col-span-2 text-fg-subtle">
                {t('tableUpdated')}:{' '}
                {formatDateTime(workflow.updatedAt, locale)}
              </span>
            </div>
            <WorkflowToggle
              id={workflow.id}
              enabled={workflow.enabled}
              className="btn-secondary w-full"
            />
          </div>
        ))}
      </div>

      {/* Tablet/desktop: data table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">{t('tableName')}</th>
                <th className="px-4 py-3 font-medium">{t('tableTrigger')}</th>
                <th className="px-4 py-3 font-medium">{t('tableNodes')}</th>
                <th className="px-4 py-3 font-medium">{t('tableUpdated')}</th>
                <th className="px-4 py-3 font-medium">{t('tableStatus')}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('tableActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="border-t border-border">
                  {/* The cap and the truncation both sit on an inner element:
                      `max-width` on a `<td>` does nothing under
                      `table-layout: auto`, and a `truncate` on the cell would
                      never fire either. */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/workflows/${workflow.id}`}
                      className="block max-w-[24rem] truncate font-medium text-fg hover:text-brand-500"
                      title={workflow.name}
                    >
                      {workflow.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    <span
                      className="block max-w-[18rem] truncate"
                      title={triggerLabel(workflow)}
                    >
                      {triggerLabel(workflow)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {t('nodeCount', { count: workflow.nodes.length })}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-subtle">
                    {formatDateTime(workflow.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <WorkflowStatusBadge enabled={workflow.enabled} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <WorkflowToggle
                      id={workflow.id}
                      enabled={workflow.enabled}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    />
                    <Link
                      href={`/admin/workflows/${workflow.id}`}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    >
                      {t('actionOpen')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
