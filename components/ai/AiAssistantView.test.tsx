// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { AiAssistantView } from './AiAssistantView'
import type {
  AiConversationSummary,
  AiMembership,
  Paginated,
} from '@/lib/api/types'

const membership: AiMembership = {
  id: 'm1',
  userId: 'u1',
  tokenBalance: 500,
  createdAt: '2026-07-23T18:00:00Z',
  revokedAt: null,
}

const emptyThreads: Paginated<AiConversationSummary> = {
  data: [],
  meta: { limit: 20, nextCursor: null, hasMore: false },
}

const REPLY = 'Sure — your order ships tomorrow.'

/**
 * `POST /api/ai/chat` answers with {@link REPLY}; every other route (the
 * thread-list refresh that follows a send) answers with an empty page.
 *
 * With `deferred`, the chat call hangs until the returned `release()` is
 * called — that's the only window in which the composer is disabled, which is
 * where the focus bug lives.
 */
function mockFetch({ deferred = false } = {}) {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/ai/chat')) {
      if (deferred) await gate
      return new Response(
        JSON.stringify({
          conversationId: 'c1',
          reply: REPLY,
          tokensSpent: 12,
          balanceRemaining: 488,
          conversationTitle: 'Order status',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify(emptyThreads), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, release: () => release() }
}

function setup(over: Partial<AiMembership> | null = {}) {
  renderWithIntl(
    <AiAssistantView
      initialMembership={over === null ? null : { ...membership, ...over }}
      initialConversations={emptyThreads}
      heading={<h1>AI assistant</h1>}
    />,
  )
  return {
    input: screen.queryByRole('textbox', { name: /message/i }) as HTMLElement,
  }
}

beforeEach(() => {
  // jsdom has no scrollTo on elements; the transcript autoscroll calls it.
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AiAssistantView composer focus', () => {
  it('returns focus to the input after sending with Enter', async () => {
    const { release } = mockFetch({ deferred: true })
    const { input } = setup()

    await userEvent.click(input)
    await userEvent.type(input, 'Where is my order?')
    await userEvent.keyboard('{Enter}')

    // While the request is in flight the field is disabled. A real browser
    // moves focus off an element the moment it is disabled; jsdom leaves it
    // there (and ignores `blur()` on a disabled element), so stand in for the
    // browser by focusing something else — without this the test would pass
    // with no focus handling at all.
    await waitFor(() => expect(input).toBeDisabled())
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    elsewhere.focus()
    expect(document.activeElement).toBe(elsewhere)

    release()
    // The reply also renders in the sr-only live region, hence `findAllByText`.
    expect(await screen.findAllByText(/ships tomorrow/i)).toHaveLength(2)
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('moves focus to the input after sending with the send button', async () => {
    mockFetch()
    const { input } = setup()

    // Focus sits on the button here, and the button disables itself the moment
    // the draft is cleared — the composer has to take focus back.
    await userEvent.type(input, 'Where is my order?')
    await userEvent.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findAllByText(/ships tomorrow/i)).toHaveLength(2)
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('leaves focus alone when a thread is opened from the rail', async () => {
    mockFetch()
    setup()

    const newChat = screen.getByRole('button', { name: /new chat/i })
    await userEvent.click(newChat)

    expect(document.activeElement).toBe(newChat)
  })
})

describe('AiAssistantView token balance', () => {
  it('sits on the heading row, not in a card of its own', () => {
    mockFetch()
    setup({ tokenBalance: 507 })

    const headingRow = screen.getByRole('heading', {
      name: /ai assistant/i,
    }).parentElement
    // Same row as the title — the old layout put it in a rail card instead.
    expect(headingRow).toContainElement(screen.getByText('507'))
    expect(screen.getByText('507').closest('.card')).toBeNull()
  })

  it('says nothing extra while the wallet is healthy', () => {
    mockFetch()
    setup()
    expect(screen.queryByText(/out of tokens/i)).toBeNull()
    expect(screen.queryByText(/no ai access/i)).toBeNull()
    expect(screen.queryByText(/access revoked/i)).toBeNull()
  })

  it('keeps showing a revoked wallet balance, with the reason beside it', () => {
    mockFetch()
    setup({ tokenBalance: 507, revokedAt: '2026-07-20T10:00:00Z' })

    expect(screen.getByText('507')).toBeInTheDocument()
    expect(screen.getByText(/access revoked/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled()
  })

  it('hides the balance entirely when the caller is not enrolled', () => {
    mockFetch()
    setup(null)

    expect(screen.queryByText('0')).toBeNull()
    expect(screen.getByText(/no ai access yet/i)).toBeInTheDocument()
  })
})
