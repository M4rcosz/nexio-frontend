'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'

/**
 * Enable/disable straight from the list or the detail header.
 *
 * Talks to `POST /api/workflow/workflows/:id/enabled`, which forwards to the
 * dedicated `activateWorkflow`/`deactivateWorkflow` mutations rather than a
 * partial update (§4). That also keeps the toggle clear of the redaction trap
 * (§2.1) entirely: no node payload is ever sent, so there is no masked
 * credential to send back by accident.
 *
 * Both lists are RSC-rendered, so the fresh copy comes from `router.refresh()`
 * after the handler's `revalidateTag` — no local optimistic state to drift.
 */
export function WorkflowToggle({
  id,
  enabled,
  className = '',
}: {
  id: string
  enabled: boolean
  className?: string
}) {
  const router = useRouter()
  const t = useTranslations('admin.workflows')
  const errorMessage = useErrorMessage()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldMessage, setFieldMessage] = useState<string | null>(null)

  function toggle() {
    setError(null)
    setFieldMessage(null)
    start(async () => {
      const res = await fetch(
        `/api/workflow/workflows/${encodeURIComponent(id)}/enabled`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: !enabled }),
        },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          code?: string
          fieldMessage?: string | null
        } | null
        setError(errorMessage(body?.code, res.status) ?? t('toggleFailed'))
        // Only BAD_REQUEST carries one, and §3's text there is human-written
        // and safe to show — but it is Portuguese-only, so it goes *beneath*
        // the translated line and is tagged with its own language.
        setFieldMessage(body?.fieldMessage ?? null)
        return
      }
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={className}
      >
        {pending
          ? t('toggling')
          : enabled
            ? t('actionDeactivate')
            : t('actionActivate')}
      </button>
      {error ? (
        <span
          role="alert"
          className="text-xs text-accent-700 dark:text-accent-300"
        >
          {error}
          {fieldMessage ? (
            <span lang="pt-BR" className="block text-fg-subtle">
              {fieldMessage}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
