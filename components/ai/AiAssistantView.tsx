'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useErrorMessage } from '@/lib/errors/useErrorMessage'
import { CHAT_HISTORY_MAX_TURNS } from '@/lib/validation/constants'
import type {
  AiMembership,
  ChatResponse,
  ChatRole,
  ChatTurn,
} from '@/lib/api/types'

type ChatMessage = {
  id: number
  role: ChatRole
  text: string
  /** Only on model turns — tokens metered for that exchange. */
  tokensSpent?: number
}

/** Set when a send is rejected because the wallet can't serve it. */
type AccessBlock = 'not_enrolled' | 'out_of_tokens'

/**
 * `initialMembership` is null when the caller is not enrolled yet (the backend
 * answers 404 on `GET /me`) — render the "no AI access" state, not an error.
 */
export function AiAssistantView({
  initialMembership,
}: {
  initialMembership: AiMembership | null
}) {
  const t = useTranslations('ai')
  const locale = useLocale()
  const errorMessage = useErrorMessage()

  const [membership, setMembership] = useState(initialMembership)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [transient, setTransient] = useState(false)
  const [accessBlock, setAccessBlock] = useState<AccessBlock | null>(
    initialMembership === null ? 'not_enrolled' : null,
  )
  const [pending, start] = useTransition()

  const nextId = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const balance = membership?.tokenBalance ?? 0
  const enrolled = membership !== null && accessBlock !== 'not_enrolled'
  const canChat = enrolled && balance > 0 && accessBlock === null

  // Keep the transcript scrolled to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  /** On a 403 the two states (not enrolled / out of tokens) look identical —
   * re-read the wallet to tell them apart, as the contract recommends. */
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
        setAccessBlock(me.tokenBalance <= 0 ? 'out_of_tokens' : null)
        return
      }
    } catch {
      /* fall through to the generic message below */
    }
    setError(t('sendFailed'))
  }

  function send() {
    const text = input.trim()
    if (!text || pending || !canChat) return
    setError(null)
    setTransient(false)

    // Replay the turns we want remembered (server is stateless), capped to the
    // server's own limit so requests stay small.
    const history: ChatTurn[] = messages
      .map((m) => ({ role: m.role, text: m.text }))
      .slice(-CHAT_HISTORY_MAX_TURNS)

    const userMessage: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      text,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    start(async () => {
      let res: Response
      try {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text, history }),
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
          // Provider down — no tokens charged, retry is safe.
          setTransient(true)
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
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'model',
          text: data.reply,
          tokensSpent: data.tokensSpent,
        },
      ])
      // Drive the balance from the response — no need to re-GET /me. A 200 with
      // balanceRemaining 0 is the "ran out mid-answer" case: keep the reply,
      // then the input disables itself.
      setMembership((prev) =>
        prev ? { ...prev, tokenBalance: data.balanceRemaining } : prev,
      )
      if (data.balanceRemaining <= 0) setAccessBlock('out_of_tokens')
    })
  }

  /** Undo the optimistic user turn after a failed send and restore the draft. */
  function rollback(id: number, text: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    setInput((cur) => (cur ? cur : text))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {/* Balance / status */}
      <section className="card h-max p-6">
        <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
          {t('balance')}
        </p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-5xl font-extrabold text-gradient-brand">
            {balance.toLocaleString(locale)}
          </span>
          <span className="text-sm font-medium text-fg-muted">
            {t('tokens')}
          </span>
        </p>

        {accessBlock === 'not_enrolled' ? (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-3 text-sm text-fg-muted">
            <p className="font-medium text-fg">{t('notEnrolledTitle')}</p>
            <p className="mt-1 text-fg-muted">{t('notEnrolledBody')}</p>
          </div>
        ) : accessBlock === 'out_of_tokens' || balance <= 0 ? (
          <div className="mt-5 rounded-xl border border-accent-500/30 bg-accent-500/10 p-3 text-sm">
            <p className="font-medium text-accent-700 dark:text-accent-300">
              {t('outOfTokensTitle')}
            </p>
            <p className="mt-1 text-fg-muted">{t('outOfTokensBody')}</p>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-relaxed text-fg-muted">
            {t('balanceHint')}
          </p>
        )}
      </section>

      {/* Chat */}
      <section className="card flex min-h-[28rem] flex-col p-0 md:col-span-2">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-mono uppercase tracking-widest text-fg-subtle">
            {t('chatTitle')}
          </p>
        </div>

        <div
          ref={listRef}
          className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-5"
          aria-live="polite"
        >
          {messages.length === 0 && !pending ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl" aria-hidden>
                💬
              </span>
              <p className="max-w-sm text-sm text-fg-muted">
                {t('emptyState')}
              </p>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} message={m} t={t} />)
          )}
          {pending ? <TypingIndicator label={t('thinking')} /> : null}
        </div>

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

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!canChat || pending}
            rows={1}
            maxLength={4000}
            placeholder={
              canChat ? t('inputPlaceholder') : t('inputDisabledPlaceholder')
            }
            aria-label={t('inputPlaceholder')}
            className="min-h-[2.75rem] max-h-40 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand-500/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canChat || pending || input.trim().length === 0}
            className="btn-primary !px-3 !py-2.5"
            aria-label={t('send')}
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </section>
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
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-brand-gradient text-white'
            : 'border border-border bg-surface-2 text-fg'
        }`}
      >
        {message.text}
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
