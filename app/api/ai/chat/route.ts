import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendChatMessage } from '@/lib/api/ai'
import { ApiError, backendErrorStatus, describeError } from '@/lib/api/errors'
import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import {
  CHAT_HISTORY_MAX_TURNS,
  CHAT_MESSAGE_MAX_LENGTH,
} from '@/lib/validation/constants'

const Turn = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
})

const Body = z.object({
  // Omit to open a new thread; echo the response's id back to continue one.
  // When present the server replays its own stored turns and ignores `history`.
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  history: z.array(Turn).max(CHAT_HISTORY_MAX_TURNS).optional(),
})

export async function POST(req: Request) {
  if (!(await hasActiveOrRefreshableSession())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: err instanceof z.ZodError ? err.flatten() : undefined,
      },
      { status: 400 },
    )
  }

  try {
    const result = await sendChatMessage(parsed)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      // Not enrolled OR out of tokens — two distinct states. The client calls
      // GET /me to disambiguate (404 there = not enrolled; 0 balance = empty).
      return NextResponse.json(
        { error: 'No AI access.', code: 'chat_no_access' },
        { status: 403 },
      )
    }
    if (err instanceof ApiError && err.status === 404) {
      // The thread is gone (deleted, or never the caller's — indistinguishable
      // by design). The client drops its stored id and starts a fresh thread.
      return NextResponse.json(
        { error: 'Conversation not found.', code: 'conversation_not_found' },
        { status: 404 },
      )
    }
    if (err instanceof ApiError && err.status === 503) {
      // Upstream provider down — no tokens charged, retry is safe.
      return NextResponse.json(
        { error: 'Assistant temporarily unavailable.', code: 'ai_unavailable' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: describeError(err) },
      { status: backendErrorStatus(err) },
    )
  }
}
