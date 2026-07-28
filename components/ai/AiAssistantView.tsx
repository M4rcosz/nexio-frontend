'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AiConversationList } from './AiConversationList'
import { Markdown } from './Markdown'
import { useCursorPages } from '@/components/admin/useCursorPages'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { formatDateTime } from '@/lib/format'
import { CHAT_REPLAYED_TURNS } from '@/lib/validation/constants'
import type {
  AiConversationDetail,
  AiConversationSummary,
  AiMembership,
  ChatResponse,
  ChatRole,
  Paginated,
} from '@/lib/api/types'

type ChatMessage = {
  id: number
  role: ChatRole
  text: string
  /** Only on model turns from this session — the stored transcript has none. */
  tokensSpent?: number
}

/** Set when a send is rejected because the wallet can't serve it. */
type AccessBlock = 'not_enrolled' | 'revoked' | 'out_of_tokens'

function blockFor(membership: AiMembership | null): AccessBlock | null {
  if (membership === null) return 'not_enrolled'
  if (membership.revokedAt !== null) return 'revoked'
  if (membership.tokenBalance <= 0) return 'out_of_tokens'
  return null
}

/**
 * `initialMembership` is null when the caller is not enrolled yet (the backend
 * answers 404 on `GET /me`) — render the "no AI access" state, not an error.
 *
 * Threads are owned by the server: every send carries the `conversationId` the
 * previous reply issued, so the assistant keeps its context. Dropping that id
 * would still "work", but each message would open a fresh single-turn thread
 * and the user's list would fill with orphans.
 *
 * `heading` is the page's own title block, passed down rather than rendered by
 * the page: the balance sits on that same row and is client state (it changes
 * after every reply), so the row has to be owned by this component.
 */
export function AiAssistantView({
  initialMembership,
  initialConversations,
  heading,
}: {
  initialMembership: AiMembership | null
  initialConversations: Paginated<AiConversationSummary>
  heading?: React.ReactNode
}) {
  const t = useTranslations('ai')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [membership, setMembership] = useState(initialMembership)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Announced to screen readers on its own. Only the newest assistant reply
  // goes here — the scroll container is NOT a live region, so opening a stored
  // thread (which replaces the whole transcript at once) never reads dozens of
  // past turns aloud end to end.
  const [announce, setAnnounce] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [transient, setTransient] = useState(false)
  const [accessBlock, setAccessBlock] = useState<AccessBlock | null>(
    blockFor(initialMembership),
  )
  const [pending, start] = useTransition()

  /** The open thread. `null` means the next send opens a new one. */
  const [conversationId, setConversationId] = useState<string | null>(null)
  /** The open thread's title — drives the chat header; `null` shows the eyebrow
   *  fallback (`chatTitle`) when no thread is open. */
  const [openTitle, setOpenTitle] = useState<string | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)

  // Title search. The box updates `search` on every keystroke; a debounced copy
  // drives the actual fetch so we don't hit the route on each character.
  const [search, setSearch] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  // True while a debounced search fetch is in flight — dims the rail and holds
  // its empty state so results don't flash in and out.
  const [searching, setSearching] = useState(false)

  const nextId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** Set when a send starts, so focus can return to the composer once it
   *  settles. The textarea is disabled while the request is in flight, and
   *  disabling the focused element blurs it to `<body>` — without this the
   *  caret is lost after every message and has to be clicked back. Only sends
   *  set it: opening a thread from the rail also flips `busy`, and stealing
   *  focus from the row the user just activated would be worse. */
  const refocusInput = useRef(false)

  // The thread list is client-owned because it reorders on every send. Holding
  // page one in state lets a reload reset `useCursorPages` (it drops appended
  // pages whenever `initialPage` changes identity) instead of leaving stale
  // rows from the previous ordering below a fresh first page.
  const [firstPage, setFirstPage] = useState(initialConversations)
  const {
    items: threads,
    hasMore,
    loading: loadingThreads,
    error: threadsError,
    loadMore,
    updateItem,
  } = useCursorPages<AiConversationSummary>({
    endpoint: '/api/ai/conversations',
    // The title filter rides along on every follow-up page so appended pages
    // compose it with the cursor — same query the first-page fetch below uses.
    query: { title: debouncedTerm || undefined },
    initialPage: firstPage,
  })

  // Debounce the search box; a blank/whitespace term means "unfiltered".
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // Skip the very first run: `initialConversations` is already the unfiltered
  // page one, so there is nothing to refetch until the term actually moves.
  const searchMounted = useRef(false)
  useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true
      return
    }
    // Abort a still-in-flight search so an earlier, slower response can't land
    // after a newer one and show stale results for a query already navigated off.
    const controller = new AbortController()
    setSearching(true)
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (debouncedTerm) params.set('title', debouncedTerm)
        const qs = params.toString()
        const res = await fetch(`/api/ai/conversations${qs ? `?${qs}` : ''}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        // New identity resets the paginator's cursor/appended pages, so the
        // filtered list starts clean from page one.
        setFirstPage((await res.json()) as Paginated<AiConversationSummary>)
      } catch {
        // Aborted or a network blip — leave the last good page on screen.
      } finally {
        // Only the request that is still current clears the flag — a superseded
        // (aborted) one must not turn off the spinner the newer request just lit.
        if (!controller.signal.aborted) setSearching(false)
      }
    })()
    return () => controller.abort()
  }, [debouncedTerm])

  const balance = membership?.tokenBalance ?? 0
  const revoked = accessBlock === 'revoked'
  const enrolled = membership !== null && accessBlock !== 'not_enrolled'
  const canChat = enrolled && !revoked && balance > 0 && accessBlock === null
  const busy = pending || loadingThread

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  // Give the composer its focus back when a send settles — see `refocusInput`.
  // Runs for the send button too: it disables itself the moment the draft is
  // cleared, so a mouse user would otherwise also end up focused on nothing.
  useEffect(() => {
    if (busy || !refocusInput.current) return
    refocusInput.current = false
    // A send that ended in a block (out of tokens, revoked) leaves the field
    // disabled — don't fight the browser over focusing it.
    if (canChat) inputRef.current?.focus()
  }, [busy, canChat])

  const reloadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/conversations')
      if (!res.ok) return
      setFirstPage((await res.json()) as Paginated<AiConversationSummary>)
    } catch {
      // The list is a convenience; a failed refresh leaves the last good page.
    }
  }, [])

  /** On a 403 the three blocked states look identical — re-read the wallet to
   * tell them apart, as the contract recommends, rather than parsing messages. */
  async function disambiguate403() {
    try {
      const res = await fetch('/api/ai/memberships/me')
      if (res.status === 404) {
        setMembership(null)
        setAccessBlock('not_enrolled')
        return
      }
      if (res.ok) {
        const me = (await res.json()) as AiMembership
        setMembership(me)
        setAccessBlock(blockFor(me))
        return
      }
    } catch {
      /* fall through to the generic message below */
    }
    setError(t('sendFailed'))
  }

  /** The open thread is gone (deleted, or never ours). Drop the id so the next
   * send starts fresh instead of retrying a dead one, and resync the list. */
  function dropDeadThread() {
    setConversationId(null)
    setOpenTitle(null)
    setMessages([])
    setError(t('threadGone'))
    void reloadThreads()
  }

  function send() {
    const text = input.trim()
    if (!text || busy || !canChat) return
    setError(null)
    setTransient(false)
    refocusInput.current = true

    const userMessage: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      text,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Captured now: a thread switch mid-flight must not redirect this reply.
    const thread = conversationId

    start(async () => {
      let res: Response
      try {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // No `history`: the server owns the transcript. It is only read on
          // the first message of a thread, and is ignored outright once a
          // conversationId is in play.
          body: JSON.stringify({
            message: text,
            ...(thread ? { conversationId: thread } : {}),
          }),
        })
      } catch {
        // Network failure — roll back the optimistic message and let them retry.
        rollback(userMessage.id, text)
        setError(errorMessage(null, 0) ?? t('sendFailed'))
        return
      }

      if (!res.ok) {
        rollback(userMessage.id, text)
        const body = (await res.json().catch(() => null)) as {
          code?: string
        } | null
        if (res.status === 503) {
          // Provider down — no tokens charged, and the thread is intact, so a
          // retry re-sends against the same conversationId.
          setTransient(true)
          return
        }
        if (res.status === 404) {
          dropDeadThread()
          return
        }
        if (res.status === 403) {
          await disambiguate403()
          return
        }
        setError(errorMessage(body?.code, res.status) ?? t('sendFailed'))
        return
      }

      const data = (await res.json()) as ChatResponse
      // Persist the server-issued id + title for the rest of this conversation.
      setConversationId(data.conversationId)
      setOpenTitle(data.conversationTitle)
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'model',
          text: data.reply,
          tokensSpent: data.tokensSpent,
        },
      ])
      setAnnounce(data.reply)
      // Drive the balance from the response — no need to re-GET /me. A 200 with
      // balanceRemaining 0 is the "ran out mid-answer" case: keep the reply,
      // then the input disables itself.
      setMembership((prev) =>
        prev ? { ...prev, tokenBalance: data.balanceRemaining } : prev,
      )
      if (data.balanceRemaining <= 0) setAccessBlock('out_of_tokens')
      // Ordering is by last activity, so the list has just reordered under us.
      await reloadThreads()
    })
  }

  /** Undo the optimistic user turn after a failed send and restore the draft. */
  function rollback(id: number, text: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setInput((cur) => (cur ? cur : text))
  }

  async function openThread(id: string) {
    if (busy || id === conversationId) return
    setLoadingThread(true)
    setError(null)
    setTransient(false)
    try {
      const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`)
      if (res.status === 404) {
        dropDeadThread()
        return
      }
      if (!res.ok) {
        setError(errorMessage(null, res.status) ?? t('threadLoadFailed'))
        return
      }
      const detail = (await res.json()) as AiConversationDetail
      // Stored roles are uppercase; the chat UI (and the `history` field, if it
      // were ever used) speak lowercase. Never feed one to the other unmapped.
      setMessages(
        detail.messages.map((m) => ({
          id: nextId.current++,
          role: m.role === 'USER' ? 'user' : 'model',
          text: m.content,
        })),
      )
      setConversationId(detail.id)
      setOpenTitle(detail.title)
    } catch {
      setError(errorMessage(null, 0) ?? t('threadLoadFailed'))
    } finally {
      setLoadingThread(false)
    }
  }

  function newChat() {
    if (busy) return
    setConversationId(null)
    setOpenTitle(null)
    setMessages([])
    setError(null)
    setTransient(false)
  }

  /**
   * Rename a thread. The row is patched IN PLACE from the response's normalized
   * title — no reorder, no `reloadThreads`. `updateItem` covers whichever page
   * the row sits on (page one or an appended one) via an id-keyed overlay, so
   * loaded pages survive. A 404 means the thread is gone; anything else surfaces
   * a generic failure (a 422 shouldn't reach here after client validation).
   */
  async function renameThread(id: string, title: string) {
    setError(null)
    let res: Response
    try {
      res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      })
    } catch {
      setError(t('renameFailed'))
      return
    }
    if (res.status === 404) {
      // The thread was deleted out from under us — drop it and resync the list.
      if (id === conversationId) dropDeadThread()
      else await reloadThreads()
      return
    }
    if (!res.ok) {
      setError(t('renameFailed'))
      return
    }
    const summary = (await res.json()) as AiConversationSummary
    updateItem(id, { title: summary.title })
    if (id === conversationId) setOpenTitle(summary.title)
  }

  async function deleteThread(id: string) {
    if (busy) return
    setError(null)
    try {
      // Idempotent upstream, so no guard against a double confirm is needed.
      const res = await fetch(
        `/api/ai/conversations/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok && res.status !== 404) {
        setError(errorMessage(null, res.status) ?? t('deleteThreadFailed'))
        return
      }
      // A deleted thread can no longer be continued — if it was the open one,
      // reset to a new chat rather than leaving a transcript that can't be
      // replied to.
      if (id === conversationId) {
        setConversationId(null)
        setOpenTitle(null)
        setMessages([])
      }
    } catch {
      setError(errorMessage(null, 0) ?? t('deleteThreadFailed'))
      return
    }
    await reloadThreads()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const outOfTokens = accessBlock === 'out_of_tokens' || balance <= 0

  return (
    <div className="space-y-6">
      {/* The balance rides the page header instead of a card in the rail: it is
          one number, it belongs next to the title it qualifies, and the space
          it used to occupy is worth more to the thread list. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {heading}
        {enrolled ? (
          /* Centred, not baseline-aligned: the unit sits at the digits' mid
             height. `leading-none` on both spans is what makes that exact —
             each span's box then hugs its glyphs, so centring the boxes centres
             what you actually see. */
          <p
            className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-2xl border bg-surface px-4 py-2.5 shadow-sm ${
              outOfTokens ? 'border-accent-500/40' : 'border-border'
            }`}
          >
            <span className="font-display text-2xl font-extrabold leading-none text-gradient-brand">
              {balance.toLocaleString(locale)}
            </span>
            {/* The unit carries the label — a bare number next to the title
                would need the eyebrow the old card had. */}
            <span className="text-xs font-medium uppercase leading-none tracking-wide text-fg-muted">
              {t('tokens')}
            </span>
          </p>
        ) : null}
      </div>

      {/* Two panes. Up to lg the chat takes two of three equal columns; from xl
          (where the shell goes wide) the side column is pinned so every extra
          pixel goes to the chat instead of inflating the rail. */}
      <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-[20rem_1fr]">
        <div className="space-y-5">
          {/* Access state. Only rendered when there is something to say — with
              the balance moved to the header, a healthy wallet needs no card
              here at all. */}
          {accessBlock === 'not_enrolled' ? (
            <section className="card h-max p-4 text-sm">
              <p className="font-medium text-fg">{t('notEnrolledTitle')}</p>
              <p className="mt-1 text-fg-muted">{t('notEnrolledBody')}</p>
            </section>
          ) : revoked ? (
            <section className="card h-max border-accent-500/30 bg-accent-500/10 p-4 text-sm">
              <p className="font-medium text-accent-700 dark:text-accent-300">
                {t('revokedTitle')}
              </p>
              {/* The balance in the header is real and preserved — say so, or
                  it reads like a display bug next to a blocked chat. */}
              <p className="mt-1 text-fg-muted">
                {t('revokedBody', {
                  date: formatDateTime(membership?.revokedAt ?? '', locale),
                })}
              </p>
            </section>
          ) : outOfTokens ? (
            <section className="card h-max border-accent-500/30 bg-accent-500/10 p-4 text-sm">
              <p className="font-medium text-accent-700 dark:text-accent-300">
                {t('outOfTokensTitle')}
              </p>
              <p className="mt-1 text-fg-muted">{t('outOfTokensBody')}</p>
            </section>
          ) : null}

          {enrolled ? (
            <AiConversationList
              threads={threads}
              activeId={conversationId}
              hasMore={hasMore}
              loading={loadingThreads}
              error={threadsError}
              searchTerm={search}
              searching={searching}
              onSearchChange={setSearch}
              onOpen={openThread}
              onRename={renameThread}
              onDelete={deleteThread}
              onNewChat={newChat}
              onLoadMore={loadMore}
              busy={busy}
            />
          ) : null}
        </div>

        {/* Chat */}
        <section className="card flex min-h-[28rem] flex-col p-0 md:col-span-2 xl:col-span-1">
          <div className="border-b border-border px-5 py-3">
            <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
              {t('chatTitle')}
            </p>
            {openTitle ? (
              <p
                className="mt-0.5 truncate text-sm font-semibold text-fg"
                title={openTitle}
              >
                {openTitle}
              </p>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5"
          >
            {/* The pane widens, the message column does not: past ~75ch the
              bubbles turn into unreadable full-width lines. */}
            <div className="mx-auto flex min-h-full w-full max-w-[75ch] flex-col gap-4">
              {messages.length === 0 && !busy ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  <span className="text-4xl" aria-hidden>
                    💬
                  </span>
                  <p className="max-w-sm text-sm text-fg-muted">
                    {t('emptyState')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Past this length the model no longer sees the earliest
                    turns, even though the transcript below is complete.
                    Surfacing it beats letting the assistant look forgetful. */}
                  {messages.length > CHAT_REPLAYED_TURNS ? (
                    <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-center text-[11px] text-fg-subtle">
                      {t('contextTrimmed', { count: CHAT_REPLAYED_TURNS })}
                    </p>
                  ) : null}
                  {messages.map((m) => (
                    <Bubble key={m.id} message={m} t={t} />
                  ))}
                </>
              )}
              {pending ? <TypingIndicator label={t('thinking')} /> : null}
            </div>
          </div>

          {/* Only the latest assistant reply is announced — see `announce`. */}
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {announce}
          </p>

          {transient ? (
            <div className="mx-5 mb-3 flex items-center justify-between gap-3 rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-xs">
              <span className="text-accent-700 dark:text-accent-300">
                {t('unavailable')}
              </span>
              <button
                type="button"
                onClick={send}
                className="font-semibold text-accent-700 hover:underline dark:text-accent-300"
              >
                {t('retry')}
              </button>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mx-5 mb-3 rounded-xl border border-accent-500/30 bg-accent-500/10 p-2 text-xs text-accent-700 dark:text-accent-300"
            >
              {error}
            </p>
          ) : null}

          {/* The composer spans the pane rather than tracking the 75ch message
            column: the cap is there to keep prose readable, and applying it to
            a single-line field just left dead gutters either side of it. */}
          <div className="border-t border-border">
            <form
              className="px-5 py-3"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              {/* The send button rides inside the field, pinned to its bottom
                  right so it stays put as the textarea grows. `pr-12` reserves
                  its lane — without it, long text runs under the button.
                  The wrapper is `flex` and the textarea `block`: as an inline
                  element the textarea sat on a text baseline, leaving a few px
                  of line-box below it that pushed the button past the field's
                  bottom edge. */}
              <div className="relative flex">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={!canChat || busy}
                  rows={1}
                  maxLength={4000}
                  placeholder={
                    canChat
                      ? t('inputPlaceholder')
                      : t('inputDisabledPlaceholder')
                  }
                  aria-label={t('inputPlaceholder')}
                  className="block max-h-40 min-h-[2.75rem] w-full resize-none rounded-3xl border border-border bg-bg py-2.5 pl-4 pr-12 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60 disabled:opacity-60"
                />
                {/* `fg` on `bg` — the inverted pair, so the button reads white
                    on the dark theme and near-black on the light one. A literal
                    `white` would vanish on light backgrounds and break the
                    per-tenant palette. */}
                <button
                  type="submit"
                  disabled={!canChat || busy || input.trim().length === 0}
                  className="absolute bottom-1.5 right-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-fg text-bg shadow-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                  aria-label={t('send')}
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

function Bubble({
  message,
  t,
}: {
  message: ChatMessage
  t: ReturnType<typeof useTranslations>
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'whitespace-pre-wrap bg-brand-gradient text-white'
            : 'border border-border bg-surface-2 text-fg'
        }`}
      >
        {/* Only model turns are Markdown — what the user typed is shown
            verbatim, so `*` in their own question stays a `*`. */}
        {isUser ? message.text : <Markdown text={message.text} />}
      </div>
      {message.tokensSpent !== undefined ? (
        <span className="mt-1 px-1 font-mono text-[10px] text-fg-subtle">
          {t('tokensSpent', { count: message.tokensSpent })}
        </span>
      ) : null}
    </div>
  )
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={label}>
      <span className="h-2 w-2 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-fg-subtle" />
    </div>
  )
}

function SendIcon({ className = '' }: { className?: string }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
