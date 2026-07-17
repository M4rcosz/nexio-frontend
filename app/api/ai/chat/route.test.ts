import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/ai')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { sendChatMessage } from '@/lib/api/ai'
import { POST } from './route'

const mockedSession = vi.mocked(hasActiveOrRefreshableSession)
const mockedSend = vi.mocked(sendChatMessage)

function req(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/ai/chat', () => {
  it('returns 401 when there is no session', async () => {
    mockedSession.mockResolvedValue(false)
    const res = await POST(req({ message: 'hi' }))
    expect(res.status).toBe(401)
    expect(mockedSend).not.toHaveBeenCalled()
  })

  it('rejects an empty message with 400', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await POST(req({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects a bad history role with 400', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await POST(
      req({ message: 'hi', history: [{ role: 'tool', text: 'x' }] }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects history longer than 50 turns with 400', async () => {
    mockedSession.mockResolvedValue(true)
    const history = Array.from({ length: 51 }, () => ({
      role: 'user',
      text: 'x',
    }))
    const res = await POST(req({ message: 'hi', history }))
    expect(res.status).toBe(400)
  })

  it('returns the reply on success', async () => {
    mockedSession.mockResolvedValue(true)
    mockedSend.mockResolvedValue({
      reply: 'hello',
      tokensSpent: 42,
      balanceRemaining: 100,
    })
    const res = await POST(req({ message: 'hi' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      reply: 'hello',
      balanceRemaining: 100,
    })
    expect(mockedSend).toHaveBeenCalledWith({
      message: 'hi',
      history: undefined,
    })
  })

  it('maps a backend 403 to code chat_no_access', async () => {
    mockedSession.mockResolvedValue(true)
    mockedSend.mockRejectedValue(new ApiError(403, null, 'no access'))
    const res = await POST(req({ message: 'hi' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'chat_no_access' })
  })

  it('maps a backend 503 to code ai_unavailable', async () => {
    mockedSession.mockResolvedValue(true)
    mockedSend.mockRejectedValue(new ApiError(503, null, 'down'))
    const res = await POST(req({ message: 'hi' }))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'ai_unavailable' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedSession.mockResolvedValue(true)
    mockedSend.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await POST(req({ message: 'hi' }))
    expect(res.status).toBe(502)
  })
})
