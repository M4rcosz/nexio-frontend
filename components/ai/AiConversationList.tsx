'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { LoadMore } from '@/components/admin/LoadMore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { isValidTitle, titleLength } from '@/lib/ai/title'
import { formatDateTime, formatRelativeTime } from '@/lib/format'
import { CONVERSATION_TITLE_MAX_LENGTH } from '@/lib/validation/constants'
import type { CursorPageError } from '@/components/admin/useCursorPages'
import type { AiConversationSummary } from '@/lib/api/types'

/** How often the "last activity" labels re-render. Half a minute, not a full
 *  one, so the `now → 1 min. ago` step is never more than 30s late; every
 *  coarser step (hours, days) has slack to spare. */
const RELATIVE_TICK_MS = 30_000

/**
 * A clock that advances every `ms`, so relative timestamps age in place
 * instead of freezing at whatever they said when the rail mounted. One
 * interval drives every row — a timer per row would scale with the page size
 * for no extra precision.
 */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/**
 * The caller's stored threads, most recent activity first.
 *
 * Each row shows the thread's title (server-derived, then user-editable via the
 * inline rename), with its last activity below. Ordering shifts as the user
 * chats, which is why the parent reloads page one after each send instead of
 * splicing rows in place — a rename, by contrast, patches the row where it sits.
 */
export function AiConversationList({
  threads,
  activeId,
  hasMore,
  loading,
  error,
  searchTerm,
  searching,
  onSearchChange,
  onOpen,
  onRename,
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
  /** Controlled title search box — filtering is done server-side by the parent. */
  searchTerm: string
  /** A debounced search fetch is in flight — dim the rail, hold the empty state. */
  searching: boolean
  onSearchChange: (value: string) => void
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => Promise<void> | void
  onDelete: (id: string) => void
  onNewChat: () => void
  onLoadMore: () => void
  /** A send or a thread load is in flight — block switching mid-exchange. */
  busy: boolean
}) {
  const t = useTranslations('ai')
  const locale = useLocale()
  const now = useNow(RELATIVE_TICK_MS)

  // Deletion is irreversible (there is no undelete endpoint), so it always
  // goes through a confirm — including from the row's inline button.
  const [confirming, setConfirming] = useState<string | null>(null)
  // The row currently in inline-rename mode, if any.
  const [editing, setEditing] = useState<string | null>(null)

  const searchActive = searchTerm.trim().length > 0

  return (
    <section className="card flex h-max flex-col p-0" aria-busy={searching}>
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

      <div className="border-b border-border px-3 py-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchAria')}
          className="input !py-1.5 text-xs"
        />
      </div>

      {threads.length === 0 ? (
        // While a search is resolving, hold a subtle loading state rather than
        // flashing the empty copy — the previous rows may still become results.
        searching ? (
          <div className="flex justify-center px-4 py-6" aria-hidden>
            <LoadingDots />
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-fg-muted">
            {searchActive ? t('noSearchResults') : t('noThreads')}
          </p>
        )
      ) : (
        // The 20rem cap keeps the rail short next to a three-column chat; from
        // xl the pane is taller and wider, so the cap is relaxed to the
        // viewport instead of removed (paging can load many threads). Dim while
        // a search resolves so the swap to fresh rows reads as an update.
        <ul
          className={`scrollbar-thin max-h-80 divide-y divide-border overflow-y-auto xl:max-h-[60vh] ${
            searching ? 'opacity-50 transition-opacity' : ''
          }`}
        >
          {threads.map((c) => {
            const active = c.id === activeId
            if (editing === c.id) {
              return (
                <li key={c.id} className="px-2 py-1">
                  <RenameRow
                    initial={c.title}
                    busy={busy}
                    titleLabel={t('renameTitleLabel')}
                    saveLabel={t('renameSave')}
                    cancelLabel={t('renameCancel')}
                    invalidLabel={t('renameInvalid')}
                    counter={(count) =>
                      t('renameCounter', {
                        count,
                        max: CONVERSATION_TITLE_MAX_LENGTH,
                      })
                    }
                    onCancel={() => setEditing(null)}
                    onSave={async (title) => {
                      await onRename(c.id, title)
                      setEditing(null)
                    }}
                  />
                </li>
              )
            }
            return (
              <li key={c.id} className="px-2 py-1">
                {/* Hover/active live on the row wrapper, not on the open
                    button: the row is one target visually, and highlighting
                    only the button left the kebab sitting in an unpainted
                    gutter. `busy` drops the hover entirely — nothing in the
                    row is clickable then. */}
                <div
                  className={`flex items-center gap-1 rounded-lg transition-colors ${
                    active
                      ? 'bg-brand-500/10'
                      : busy
                        ? ''
                        : 'hover:bg-surface-2'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    disabled={busy}
                    aria-current={active ? 'true' : undefined}
                    className={`min-w-0 flex-1 overflow-hidden rounded-lg px-2 py-2 text-left text-xs disabled:opacity-50 ${
                      active ? 'text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {/* Render as text — the title is user-authored. Clamp with
                        `truncate`; the full value is on the native tooltip. */}
                    <span
                      className="block truncate font-medium text-fg"
                      title={c.title}
                    >
                      {c.title}
                    </span>
                    {/* Age of the last activity, not the wall-clock stamp —
                        the exact instant stays on the tooltip. Server and
                        client render it a tick apart, hence the suppressed
                        hydration warning. */}
                    <time
                      dateTime={c.updatedAt}
                      title={formatDateTime(c.updatedAt, locale)}
                      suppressHydrationWarning
                      className="block text-[11px] text-fg-subtle"
                    >
                      {formatRelativeTime(c.updatedAt, locale, now)}
                    </time>
                  </button>
                  <ThreadMenu
                    label={t('threadActions')}
                    renameLabel={t('renameThread')}
                    deleteLabel={t('deleteThread')}
                    disabled={busy}
                    onRename={() => setEditing(c.id)}
                    onDelete={() => setConfirming(c.id)}
                  />
                </div>
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

/**
 * Inline rename editor for a single row. The counter and Save gate both count
 * CODE POINTS (`titleLength`), so an 80-emoji title validates where a UTF-16
 * `maxLength` would wrongly cut it — hence no `maxLength` on the input.
 */
function RenameRow({
  initial,
  busy,
  titleLabel,
  saveLabel,
  cancelLabel,
  invalidLabel,
  counter,
  onSave,
  onCancel,
}: {
  initial: string
  busy: boolean
  titleLabel: string
  saveLabel: string
  cancelLabel: string
  invalidLabel: string
  counter: (count: number) => string
  onSave: (title: string) => Promise<void> | void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const counterId = useId()
  const invalidId = useId()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const valid = isValidTitle(value)
  // Count the TRIMMED value: a trailing space must not read as "81/80" while
  // Save is (correctly) still enabled. Save itself gates on `isValidTitle`.
  const count = titleLength(value.trim())

  function save() {
    if (!valid || busy) return
    void onSave(value)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      // Escape cancels; leaving the whole editor (Tab/click away) cancels too,
      // but focus moving between the input and its buttons must not.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          onCancel()
      }}
      className="flex flex-col gap-1.5 px-1 py-1"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        aria-label={titleLabel}
        aria-invalid={!valid}
        aria-describedby={valid ? counterId : `${counterId} ${invalidId}`}
        className="input !py-1.5 text-xs"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          id={counterId}
          className={`font-mono text-[10px] ${
            valid ? 'text-fg-subtle' : 'text-accent-600 dark:text-accent-300'
          }`}
        >
          {counter(count)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            // Firefox/Safari don't focus a button on mousedown, so without this
            // the click would fire blur→cancel and unmount before it lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancel}
            className="btn-secondary !px-2 !py-1 text-[11px]"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            disabled={!valid || busy}
            className="btn-primary !px-2 !py-1 text-[11px] disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
      {!valid ? (
        <p
          id={invalidId}
          className="text-[10px] text-accent-600 dark:text-accent-300"
        >
          {invalidLabel}
        </p>
      ) : null}
    </form>
  )
}

/** Three bouncing dots — the rail's in-place busy affordance while a search
 *  resolves, matching the chat pane's typing indicator. */
function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" />
    </div>
  )
}

/** Roughly what the open menu occupies — used only to decide whether it opens
 *  downwards or flips above the trigger near the bottom of the viewport. */
const MENU_HEIGHT = 96

/**
 * Per-row overflow menu.
 *
 * Positioned `fixed` from the trigger's rect rather than `absolute`: the thread
 * list is a scroll container (`overflow-y-auto`), which would clip an absolutely
 * positioned panel on the last rows. The trade-off is that the panel does not
 * follow the anchor, so any scroll or resize closes it.
 *
 * The panel is portalled to `<body>` because `fixed` alone is not enough here:
 * `RouteTransition` wraps every page in an element that animates `transform`,
 * which makes it the containing block for fixed descendants and shifted the
 * panel by the page container's offset. Only a portal escapes that.
 */
function ThreadMenu({
  label,
  renameLabel,
  deleteLabel,
  disabled,
  onRename,
  onDelete,
}: {
  label: string
  renameLabel: string
  deleteLabel: string
  disabled: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  /** Close and hand focus back to the trigger — required after Escape, and the
   *  sane default after acting on an item. */
  const close = useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  function toggle() {
    if (open) {
      close(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const flip = rect.bottom + MENU_HEIGHT > window.innerHeight
    setPos({
      top: flip ? rect.top - MENU_HEIGHT : rect.bottom + 6,
      right: window.innerWidth - rect.right,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      close(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    // Capture: the anchor may scroll inside the thread list, not just the page.
    function onReflow() {
      close(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open, close])

  // Move focus into the panel so the menu is operable from the keyboard.
  useEffect(() => {
    if (open) menuRef.current?.querySelector('button')?.focus()
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        // Not `surface-2`: the row it sits on is already painted with that on
        // hover, so the trigger's own hover would vanish exactly when it's
        // reachable. `border` is one visible step from `surface-2` in both
        // themes (darker in light, lighter in dark).
        className="flex-none rounded-lg p-2 text-fg-subtle transition-colors hover:bg-border hover:text-fg disabled:opacity-50"
      >
        <KebabIcon className="h-4 w-4" />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              style={{ top: pos.top, right: pos.right }}
              className="animate-fade-in fixed z-50 min-w-44 rounded-xl border border-border bg-bg-elevated p-1 shadow-soft-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close(false)
                  onRename()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <PencilIcon className="h-4 w-4 flex-none" />
                {renameLabel}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  onDelete()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-fg-muted transition-colors hover:bg-accent-500/10 hover:text-accent-600 dark:hover:text-accent-300"
              >
                <TrashIcon className="h-4 w-4 flex-none" />
                {deleteLabel}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function KebabIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  )
}

function PencilIcon({ className = '' }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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
