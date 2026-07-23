import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api/errors'

vi.mock('@/lib/auth/session')
vi.mock('@/lib/api/ai')

import { hasActiveOrRefreshableSession } from '@/lib/auth/session'
import { listAiConversations } from '@/lib/api/ai'
import { GET } from './route'

const mockedSession = vi.mocked(hasActiveOrRefreshableSession)
const mockedList = vi.mocked(listAiConversations)

function req(query = ''): Request {
  return new Request(`http://localhost/api/ai/conversations${query}`)
}

const emptyPage = {
  data: [],
  meta: { limit: 20, nextCursor: null, hasMore: false },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/ai/conversations', () => {
  it('returns 401 when there is no session', async () => {
    mockedSession.mockResolvedValue(false)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockedList).not.toHaveBeenCalled()
  })

  it('clamps limit into the contract range', async () => {
    mockedSession.mockResolvedValue(true)
    mockedList.mockResolvedValue(emptyPage)
    await GET(req('?limit=5000'))
    expect(mockedList).toHaveBeenCalledWith({ limit: 100, cursor: undefined })
  })

  it('forwards the cursor verbatim — it is opaque, never parsed', async () => {
    mockedSession.mockResolvedValue(true)
    mockedList.mockResolvedValue(emptyPage)
    await GET(req('?cursor=eyJ0IjoxfQ'))
    expect(mockedList).toHaveBeenCalledWith({
      limit: 20,
      cursor: 'eyJ0IjoxfQ',
    })
  })

  it('maps the backend 422 on a malformed cursor to code invalid_cursor', async () => {
    mockedSession.mockResolvedValue(true)
    mockedList.mockRejectedValue(new ApiError(422, null, 'bad cursor'))
    const res = await GET(req('?cursor=garbage'))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'invalid_cursor' })
  })

  it('collapses an unexpected backend 500 into a 502', async () => {
    mockedSession.mockResolvedValue(true)
    mockedList.mockRejectedValue(new ApiError(500, null, 'boom'))
    const res = await GET(req())
    expect(res.status).toBe(502)
  })
})
