import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/ai')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import {
  deleteAiConversation,
  getAiConversation,
  renameAiConversation,
} from '@/lib/api/ai'
import { DELETE, GET, PATCH } from './route'

const mockedSession = vi.mocked(hasActiveOrRefreshableSession)
const mockedGet = vi.mocked(getAiConversation)
const mockedDelete = vi.mocked(deleteAiConversation)
const mockedRename = vi.mocked(renameAiConversation)

const ID = '11111111-1111-4111-8111-111111111111'

function ctx(conversationId: string) {
  return { params: Promise.resolve({ conversationId }) }
}

function req(method = 'GET'): Request {
  return new Request(`http://localhost/api/ai/conversations/${ID}`, { method })
}

function patchReq(body: unknown, id = ID): Request {
  return new Request(`http://localhost/api/ai/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const summary = {
  id: ID,
  title: 'Order status',
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

describe('PATCH /api/ai/conversations/[conversationId]', () => {
  it('returns 401 when there is no session', async () => {
    mockedSession.mockResolvedValue(false)
    const res = await PATCH(patchReq({ title: 'x' }), ctx(ID))
    expect(res.status).toBe(401)
    expect(mockedRename).not.toHaveBeenCalled()
  })

  it('answers 404 for a non-uuid id without calling the backend', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await PATCH(patchReq({ title: 'x' }, 'nope'), ctx('nope'))
    expect(res.status).toBe(404)
    expect(mockedRename).not.toHaveBeenCalled()
  })

  it('answers 400 when the title is not a string', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await PATCH(patchReq({ title: 42 }), ctx(ID))
    expect(res.status).toBe(400)
    expect(mockedRename).not.toHaveBeenCalled()
  })

  it('answers 422 title_invalid for a blank title', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await PATCH(patchReq({ title: '   ' }), ctx(ID))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'title_invalid' })
    expect(mockedRename).not.toHaveBeenCalled()
  })

  it('answers 422 title_invalid for over 80 code points (counting emoji as one)', async () => {
    mockedSession.mockResolvedValue(true)
    const res = await PATCH(patchReq({ title: '🌵'.repeat(81) }), ctx(ID))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'title_invalid' })
    expect(mockedRename).not.toHaveBeenCalled()
  })

  it('maps a rename that resolves null to 404 conversation_not_found', async () => {
    mockedSession.mockResolvedValue(true)
    mockedRename.mockResolvedValue(null)
    const res = await PATCH(patchReq({ title: 'valid' }), ctx(ID))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'conversation_not_found' })
  })

  it('returns 200 with the normalized summary on success', async () => {
    mockedSession.mockResolvedValue(true)
    mockedRename.mockResolvedValue({ ...summary, title: 'Order status' })
    const res = await PATCH(patchReq({ title: '  Order   status  ' }), ctx(ID))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ title: 'Order status' })
    expect(mockedRename).toHaveBeenCalledWith(ID, '  Order   status  ')
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedSession.mockResolvedValue(true)
    mockedRename.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await PATCH(patchReq({ title: 'valid' }), ctx(ID))
    expect(res.status).toBe(502)
  })
})
