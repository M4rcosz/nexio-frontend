'use client'

import { Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { REDACTED_MARKER } from '@/lib/api/workflow/redaction'
import type { JsonObject, WorkflowNode } from '@/lib/api/workflow/types'

/**
 * Read-only summary of a workflow's graph, in array order.
 *
 * Two things this must get right:
 *
 * 1. **Masked values never render as text.** Credential-shaped values arrive as
 *    the literal `***REDACTED***` (§2.1), and showing that string to an
 *    operator reads like corrupted data. Every value goes through
 *    {@link MaskedValue}, which swaps each occurrence for a chip. It splits
 *    rather than compares, because `url` is masked *in place*
 *    (`?token=***REDACTED***`) — the marker is a fragment there, not the whole
 *    value. Verified against the running service (2026-09): it masks
 *    `headers` but **not** the query string of `url`, even though §2.1 says it
 *    does, so a credential in a url arrives in clear today. Nothing to fix
 *    here — the split handles both — but do not treat a url as pre-sanitised.
 * 2. **The field set is per type.** HTTP_REQUEST owns
 *    `url`/`method`/`headers`/`body`/`nextOnSuccess`; CONDITION owns
 *    `expression`/`nextOnTrue`/`nextOnFalse` (§6). Rendering the other type's
 *    empty fields would suggest they are settable.
 */
export function NodeSummaryList({
  nodes,
  startNodeId,
}: {
  nodes: WorkflowNode[]
  startNodeId: string | null
}) {
  const t = useTranslations('admin.workflows.nodes')

  if (nodes.length === 0) {
    return <p className="text-sm text-fg-muted">{t('empty')}</p>
  }

  return (
    <ul className="grid gap-3">
      {nodes.map((node) => (
        <li key={node.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate font-mono text-sm font-medium text-fg">
              {node.id}
            </code>
            <span className="chip">
              {node.type === 'CONDITION' ? t('typeCondition') : t('typeHttp')}
            </span>
            {node.id === startNodeId ? (
              <span className="chip-brand">{t('startBadge')}</span>
            ) : null}
          </div>

          <dl className="grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-[8rem_1fr]">
            {node.type === 'HTTP_REQUEST' ? (
              <>
                <Field label={t('method')} value={node.method} />
                <Field label={t('url')} value={node.url} />
                <JsonField label={t('headers')} value={node.headers} />
                <JsonField label={t('body')} value={node.body} />
                <Field
                  label={t('nextOnSuccess')}
                  value={node.nextOnSuccess}
                  fallback={t('nextEnd')}
                />
              </>
            ) : (
              <>
                <Field label={t('expression')} value={node.expression} />
                <Field
                  label={t('nextOnTrue')}
                  value={node.nextOnTrue}
                  fallback={t('nextEnd')}
                />
                <Field
                  label={t('nextOnFalse')}
                  value={node.nextOnFalse}
                  fallback={t('nextEnd')}
                />
              </>
            )}
            <JsonField label={t('config')} value={node.config} />
          </dl>
        </li>
      ))}
    </ul>
  )
}

/** One scalar row. Hidden entirely when there is nothing and no fallback. */
function Field({
  label,
  value,
  fallback,
}: {
  label: string
  value: string | null | undefined
  fallback?: string
}) {
  if (value === null || value === undefined || value === '') {
    if (!fallback) return null
    return (
      <>
        <dt className="text-fg-subtle">{label}</dt>
        <dd className="text-fg-subtle">{fallback}</dd>
      </>
    )
  }
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0">
        <MaskedValue value={value} />
      </dd>
    </>
  )
}

/**
 * A `JSON` scalar row. Rendered as flat `key → value` pairs rather than a
 * pretty-printed blob: the values are strings the user typed (or a mask), and a
 * `<pre>` of the whole object would bury the one masked entry that matters.
 */
function JsonField({
  label,
  value,
}: {
  label: string
  value: JsonObject | null | undefined
}) {
  const entries =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value)
      : []
  if (entries.length === 0) return null
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 space-y-1">
        {entries.map(([key, entry]) => (
          <div key={key} className="flex flex-wrap items-baseline gap-1.5">
            <code className="font-mono text-fg-muted">{key}</code>
            <MaskedValue
              value={typeof entry === 'string' ? entry : JSON.stringify(entry)}
            />
          </div>
        ))}
      </dd>
    </>
  )
}

/**
 * Renders a value, replacing every `***REDACTED***` occurrence with a chip.
 *
 * Splitting (not comparing) is what makes an in-place mask work: a url masked
 * as `https://host/path?token=***REDACTED***` keeps its host and path visible
 * while the credential shows as "hidden for security".
 */
function MaskedValue({ value }: { value: string }) {
  const t = useTranslations('admin.workflows.nodes')
  const parts = value.split(REDACTED_MARKER)

  if (parts.length === 1) {
    return <span className="break-all font-mono text-fg">{value}</span>
  }

  return (
    <span className="break-all font-mono text-fg">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <span
              className="chip-warn font-sans"
              title={t('secretHiddenTitle')}
            >
              <LockIcon className="h-3 w-3" />
              {t('secretHidden')}
            </span>
          ) : null}
        </Fragment>
      ))}
    </span>
  )
}

function LockIcon({ className = '' }: { className?: string }) {
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
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
