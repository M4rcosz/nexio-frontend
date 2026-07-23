'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoadMore } from '@/components/admin/LoadMore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDateTime } from '@/lib/format'
import type { CursorPageError } from '@/components/admin/useCursorPages'
import type { AiConversationSummary } from '@/lib/api/types'

/**
 * The caller's stored threads, most recent activity first.
 *
 * Threads carry no server-side title, so a row is identified by its last
 * activity. Ordering shifts as the user chats, which is why the parent reloads
 * page one after each send instead of splicing rows in place.
 */
export function AiConversationList({
  threads,
  activeId,
  hasMore,
  loading,
  error,
  onOpen,
  onDelete,
  onNewChat,
  onLoadMore,
  busy,
}: {
  threads: AiConversationSummary[]
  /** The thread currently open in the chat pane, if any. */
  activeId: string | null
  hasMore: boolean
  loading: boolean
  error: CursorPageError | null
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
  onLoadMore: () => void
  /** A send or a thread load is in flight — block switching mid-exchange. */
  busy: boolean
}) {
  const t = useTranslations('ai')
  const locale = useLocale()

  // Deletion is irreversible (there is no undelete endpoint), so it always
  // goes through a confirm — including from the row's inline button.
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <section className="card flex h-max flex-col p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
          {t('threads')}
        </p>
        <button
          type="button"
          onClick={onNewChat}
          disabled={busy}
          className="btn-secondary !px-2.5 !py-1 text-xs disabled:opacity-50"
        >
          {t('newChat')}
        </button>
      </div>

      {threads.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-fg-muted">
          {t('noThreads')}
        </p>
      ) : (
        <ul className="scrollbar-thin max-h-80 divide-y divide-border overflow-y-auto">
          {threads.map((c) => {
            const active = c.id === activeId
            return (
              <li key={c.id} className="flex items-center gap-1 px-2 py-1">
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  disabled={busy}
                  aria-current={active ? 'true' : undefined}
                  className={`flex-1 rounded-lg px-2 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
                    active
                      ? 'bg-brand-500/10 text-fg'
                      : 'text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  <span className="block font-medium text-fg">
                    {formatDateTime(c.updatedAt, locale)}
                  </span>
                  <span className="block text-[11px] text-fg-subtle">
                    {t('threadStarted', {
                      date: formatDateTime(c.createdAt, locale),
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(c.id)}
                  disabled={busy}
                  aria-label={t('deleteThread')}
                  title={t('deleteThread')}
                  className="rounded-lg p-2 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-accent-600 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="px-4 pb-4">
        <LoadMore
          hasMore={hasMore}
          loading={loading}
          error={error}
          loaded={threads.length}
          onLoadMore={onLoadMore}
        />
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={t('deleteThread')}
        // Spells out both irreversible parts: no undelete, and — because a
        // user could reasonably assume otherwise — deleting does NOT clear the
        // token usage an admin can still see.
        message={t('deleteThreadConfirm')}
        confirmLabel={t('deleteThread')}
        danger
        onConfirm={() => {
          if (confirming) onDelete(confirming)
          setConfirming(null)
        }}
        onCancel={() => setConfirming(null)}
      />
    </section>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
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
      <path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
