import { describe, it, expect } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  adjustAiMembershipBalanceMock,
  enrollAiMembershipMock,
  getMyAiMembershipMock,
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
