import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/ai')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { deleteAiConversation, getAiConversation } from '@/lib/api/ai'
import { DELETE, GET } from './route'

const mockedSession = vi.mocked(hasActiveOrRefreshableSession)
const mockedGet = vi.mocked(getAiConversation)
const mockedDelete = vi.mocked(deleteAiConversation)

const ID = '11111111-1111-4111-8111-111111111111'

function ctx(conversationId: string) {
  return { params: Promise.resolve({ conversationId }) }
}

function req(method = 'GET'): Request {
  return new Request(`http://localhost/api/ai/conversations/${ID}`, { method })
}

const summary = {
  id: ID,
  isDeleted: false,
  createdAt: '2026-07-20T21:00:00.000Z',
  updatedAt: '2026-07-21T09:12:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ai/conversations/[conversationId]', () => {
  it('returns 401 when there is no session', async () => {
    mockedSession.mockResolvedValue(false)
    const res = await GET(req(), ctx(ID))
    expect(res.status).toBe(401)
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('returns the transcript with its uppercase stored roles intact', async () => {
    mockedSession.mockResolvedValue(true)
    mockedGet.mockResolvedValue({
      ...summary,
      messages: [
        {
          id: 'm1',
          role: 'USER',
          content: 'oi',
          createdAt: '2026-07-20T21:00:00.000Z',
        },
        {
          id: 'm2',
          role: 'MODEL',
          content: 'ola',
          createdAt: '2026-07-20T21:00:01.000Z',
        },
      ],
    })
    const res = await GET(req(), ctx(ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      'USER',
      'MODEL',
    ])
  })

  it('answers 404 for a non-uuid id without calling the backend', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await GET(req(), ctx('not-a-uuid'))
    expect(res.status).toBe(404)
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it('answers 404 identically for a thread that is not the caller’s', async () => {
    mockedSession.mockResolvedValue(true)
    mockedGet.mockResolvedValue(null)
    const res = await GET(req(), ctx(ID))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'conversation_not_found' })
  })
})

describe('DELETE /api/ai/conversations/[conversationId]', () => {
  it('returns the soft-deleted row', async () => {
    mockedSession.mockResolvedValue(true)
    mockedDelete.mockResolvedValue({ ...summary, isDeleted: true })
    const res = await DELETE(req('DELETE'), ctx(ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ isDeleted: true })
  })

  it('is idempotent — a repeat delete is still a 200, not a 404', async () => {
    mockedSession.mockResolvedValue(true)
    mockedDelete.mockResolvedValue({ ...summary, isDeleted: true })
    expect((await DELETE(req('DELETE'), ctx(ID))).status).toBe(200)
    expect((await DELETE(req('DELETE'), ctx(ID))).status).toBe(200)
  })

  it('maps an unknown thread to 404 conversation_not_found', async () => {
    mockedSession.mockResolvedValue(true)
    mockedDelete.mockResolvedValue(null)
    const res = await DELETE(req('DELETE'), ctx(ID))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'conversation_not_found' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedSession.mockResolvedValue(true)
    mockedDelete.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await DELETE(req('DELETE'), ctx(ID))
    expect(res.status).toBe(502)
  })
})
