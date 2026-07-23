import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  adjustAiMembershipBalanceMock,
  deleteAiConversationMock,
  enrollAiMembershipMock,
  getAiConversationMock,
  getMyAiMembershipMock,
  listAiConversationsMock,
  listAiMembershipUsageMock,
  reinstateAiMembershipMock,
  revokeAiMembershipMock,
  sendChatMessageMock,
} from './ai'

// The mock keeps a module-level store keyed by userId, so each test uses a
// unique id to stay isolated.

describe('ai mock — memberships', () => {
  it('seeds a wallet on first self-service read', async () => {
    const m = await getMyAiMembershipMock('self-1')
    expect(m.userId).toBe('self-1')
    expect(m.tokenBalance).toBeGreaterThan(0)
  })

  it('enrolls a fresh user and rejects a second enroll with 409', async () => {
    const m = await enrollAiMembershipMock('enroll-1', 500)
    expect(m.tokenBalance).toBe(500)
    await expect(enrollAiMembershipMock('enroll-1', 100)).rejects.toMatchObject(
      {
        status: 409,
      },
    )
  })

  it('returns null when adjusting an unenrolled user', async () => {
    expect(await adjustAiMembershipBalanceMock('ghost-1', 100)).toBeNull()
  })

  it('applies a signed delta', async () => {
    await enrollAiMembershipMock('adj-1', 1000)
    const up = await adjustAiMembershipBalanceMock('adj-1', 500)
    expect(up?.tokenBalance).toBe(1500)
    const down = await adjustAiMembershipBalanceMock('adj-1', -600)
    expect(down?.tokenBalance).toBe(900)
  })

  it('rejects a below-zero adjustment with 422', async () => {
    await enrollAiMembershipMock('adj-2', 100)
    await expect(
      adjustAiMembershipBalanceMock('adj-2', -101),
    ).rejects.toMatchObject({ status: 422 })
  })
})

describe('ai mock — chat', () => {
  it('throws 403 when the user is not enrolled', async () => {
    await expect(
      sendChatMessageMock('chat-ghost', { message: 'hi' }),
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      sendChatMessageMock('chat-ghost', { message: 'hi' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('meters tokens and never drives the balance negative', async () => {
    await enrollAiMembershipMock('chat-1', 60)
    const first = await sendChatMessageMock('chat-1', {
      message: 'hello there',
    })
    expect(first.tokensSpent).toBeGreaterThan(0)
    expect(first.balanceRemaining).toBe(60 - first.tokensSpent)
    expect(first.balanceRemaining).toBeGreaterThanOrEqual(0)
  })

  it('empties the balance and then blocks with 403', async () => {
    await enrollAiMembershipMock('chat-2', 40)
    const res = await sendChatMessageMock('chat-2', { message: 'drain it' })
    expect(res.balanceRemaining).toBe(0)
    await expect(
      sendChatMessageMock('chat-2', { message: 'again' }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('ai mock — revoke / reinstate', () => {
  it('revokes without touching the balance, and reinstating restores access', async () => {
    await enrollAiMembershipMock('rev-1', 900)
    const revoked = await revokeAiMembershipMock('rev-1')
    expect(revoked?.revokedAt).not.toBeNull()
    // The whole point of a soft revoke: the wallet survives it.
    expect(revoked?.tokenBalance).toBe(900)

    const back = await reinstateAiMembershipMock('rev-1')
    expect(back?.revokedAt).toBeNull()
    expect(back?.tokenBalance).toBe(900)
  })

  it('is idempotent — a repeat revoke keeps the original timestamp', async () => {
    await enrollAiMembershipMock('rev-2', 10)
    const first = await revokeAiMembershipMock('rev-2')
    const second = await revokeAiMembershipMock('rev-2')
    expect(second?.revokedAt).toBe(first?.revokedAt)
  })

  it('blocks chat and balance changes while revoked', async () => {
    await enrollAiMembershipMock('rev-3', 5000)
    await revokeAiMembershipMock('rev-3')
    await expect(
      sendChatMessageMock('rev-3', { message: 'hi' }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      adjustAiMembershipBalanceMock('rev-3', 100),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('returns null for an unenrolled user', async () => {
    expect(await revokeAiMembershipMock('rev-ghost')).toBeNull()
    expect(await reinstateAiMembershipMock('rev-ghost')).toBeNull()
  })
})

describe('ai mock — conversations', () => {
  it('opens a thread on the first message and continues it thereafter', async () => {
    await enrollAiMembershipMock('conv-1', 100_000)
    const first = await sendChatMessageMock('conv-1', { message: 'oi' })
    expect(first.conversationId).toBeTruthy()

    const second = await sendChatMessageMock('conv-1', {
      message: 'e o pedido?',
      conversationId: first.conversationId,
    })
    expect(second.conversationId).toBe(first.conversationId)

    const page = await listAiConversationsMock('conv-1')
    expect(page.data).toHaveLength(1)

    const detail = await getAiConversationMock('conv-1', first.conversationId)
    // Two exchanges, each storing a USER and a MODEL turn.
    expect(detail?.messages).toHaveLength(4)
    expect(detail?.messages.map((m) => m.role)).toEqual([
      'USER',
      'MODEL',
      'USER',
      'MODEL',
    ])
  })

  it('opens a separate thread per message when the id is not echoed back', async () => {
    await enrollAiMembershipMock('conv-2', 100_000)
    const a = await sendChatMessageMock('conv-2', { message: 'one' })
    const b = await sendChatMessageMock('conv-2', { message: 'two' })
    expect(b.conversationId).not.toBe(a.conversationId)
    expect((await listAiConversationsMock('conv-2')).data).toHaveLength(2)
  })

  it('never exposes another user’s thread', async () => {
    await enrollAiMembershipMock('conv-3', 100_000)
    const mine = await sendChatMessageMock('conv-3', { message: 'secret' })
    expect(
      await getAiConversationMock('someone-else', mine.conversationId),
    ).toBeNull()
  })

  it('soft-deletes idempotently and blocks continuing the thread', async () => {
    await enrollAiMembershipMock('conv-4', 100_000)
    const { conversationId } = await sendChatMessageMock('conv-4', {
      message: 'hi',
    })

    const gone = await deleteAiConversationMock('conv-4', conversationId)
    expect(gone?.isDeleted).toBe(true)
    // Idempotent: the second call is a 200-equivalent, not a miss.
    expect(
      (await deleteAiConversationMock('conv-4', conversationId))?.isDeleted,
    ).toBe(true)

    expect(await getAiConversationMock('conv-4', conversationId)).toBeNull()
    expect((await listAiConversationsMock('conv-4')).data).toHaveLength(0)
    await expect(
      sendChatMessageMock('conv-4', { message: 'again', conversationId }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('seeds a new thread from history but ignores it on a continuation', async () => {
    await enrollAiMembershipMock('conv-5', 100_000)
    const opened = await sendChatMessageMock('conv-5', {
      message: 'now',
      history: [{ role: 'user', text: 'earlier' }],
    })
    const seeded = await getAiConversationMock('conv-5', opened.conversationId)
    expect(seeded?.messages[0]).toMatchObject({
      role: 'USER',
      content: 'earlier',
    })

    await sendChatMessageMock('conv-5', {
      message: 'next',
      conversationId: opened.conversationId,
      history: [{ role: 'user', text: 'should be discarded' }],
    })
    const after = await getAiConversationMock('conv-5', opened.conversationId)
    expect(
      after?.messages.some((m) => m.content === 'should be discarded'),
    ).toBe(false)
  })
})

describe('ai mock — admin usage report', () => {
  it('reports spend inside the window and keeps it after a delete', async () => {
    await enrollAiMembershipMock('usage-1', 100_000)
    const { conversationId, tokensSpent } = await sendChatMessageMock(
      'usage-1',
      { message: 'count me' },
    )

    const before = await listAiMembershipUsageMock({ limit: 100 })
    const row = before.data.find((r) => r.userId === 'usage-1')
    expect(row?.tokensUsedInPeriod).toBe(tokensSpent)

    await deleteAiConversationMock('usage-1', conversationId)

    // Spend lives in a per-user ledger — deleting the thread must not clear it.
    const after = await listAiMembershipUsageMock({ limit: 100 })
    expect(
      after.data.find((r) => r.userId === 'usage-1')?.tokensUsedInPeriod,
    ).toBe(tokensSpent)
  })

  it('echoes the applied window and defaults to the last 30 days', async () => {
    const report = await listAiMembershipUsageMock({ limit: 1 })
    const span =
      new Date(report.periodTo).getTime() -
      new Date(report.periodFrom).getTime()
    expect(Math.round(span / 86_400_000)).toBe(30)
  })

  it('rejects an inverted window with 422', async () => {
    await expect(
      listAiMembershipUsageMock({
        from: '2026-07-01T00:00:00Z',
        to: '2026-06-01T00:00:00Z',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('keeps revoked members visible with their past spend', async () => {
    await enrollAiMembershipMock('usage-2', 100_000)
    await sendChatMessageMock('usage-2', { message: 'spend' })
    await revokeAiMembershipMock('usage-2')

    const report = await listAiMembershipUsageMock({ limit: 100 })
    const row = report.data.find((r) => r.userId === 'usage-2')
    expect(row?.isRevoked).toBe(true)
    expect(row?.tokensUsedInPeriod).toBeGreaterThan(0)
  })
})
