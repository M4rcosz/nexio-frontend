// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackendStatusStore } from './store'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** A probe that answers from a queue, then keeps repeating the last answer. */
function probeSequence(...answers: boolean[]) {
  return vi.fn(async () => (answers.length > 1 ? answers.shift()! : answers[0]))
}

describe('backend status store', () => {
  it('starts idle', () => {
    const store = createBackendStatusStore({ probe: probeSequence(true) })
    expect(store.getSnapshot()).toEqual({ phase: 'idle', wokeAt: null })
  })

  it('goes straight to up without a wake when the backend is already awake', async () => {
    const store = createBackendStatusStore({ probe: probeSequence(true) })
    await store.check()
    expect(store.getSnapshot()).toEqual({ phase: 'up', wokeAt: null })
  })

  it('polls while waking and stamps wokeAt once the backend answers', async () => {
    const probe = probeSequence(false, false, true)
    const store = createBackendStatusStore({ probe, pollIntervalMs: 1000 })
    const done = store.check()

    await vi.advanceTimersByTimeAsync(0)
    expect(store.getSnapshot().phase).toBe('waking')

    await vi.advanceTimersByTimeAsync(2000)
    await done
    expect(probe).toHaveBeenCalledTimes(3)
    expect(store.getSnapshot().phase).toBe('up')
    expect(store.getSnapshot().wokeAt).not.toBeNull()
  })

  it('gives up as unavailable, and a retry recovers with a wake', async () => {
    let up = false
    const probe = vi.fn(async () => up)
    const store = createBackendStatusStore({
      probe,
      pollIntervalMs: 1000,
      giveUpAfterMs: 3000,
    })
    const first = store.check()
    await vi.advanceTimersByTimeAsync(5000)
    await first
    expect(store.getSnapshot().phase).toBe('unavailable')

    up = true
    const retry = store.check()
    // Shows progress immediately instead of sitting on "unavailable".
    expect(store.getSnapshot().phase).toBe('waking')
    await retry
    expect(store.getSnapshot().phase).toBe('up')
    expect(store.getSnapshot().wokeAt).not.toBeNull()
  })

  it('coalesces concurrent checks into one poller', async () => {
    const probe = probeSequence(true)
    const store = createBackendStatusStore({ probe })
    await Promise.all([store.check(), store.check(), store.check()])
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('notifies subscribers and stops after unsubscribe', async () => {
    const store = createBackendStatusStore({ probe: probeSequence(true) })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    await store.check()
    expect(listener).toHaveBeenCalled()

    listener.mockClear()
    unsubscribe()
    await store.check()
    expect(listener).not.toHaveBeenCalled()
  })

  it('checkIfStale re-probes only once the last answer is old', async () => {
    let t = 0
    const probe = probeSequence(true)
    const store = createBackendStatusStore({
      probe,
      staleAfterMs: 60_000,
      now: () => t,
    })
    await store.check()
    t = 30_000
    await store.checkIfStale()
    expect(probe).toHaveBeenCalledTimes(1)

    t = 61_000
    await store.checkIfStale()
    expect(probe).toHaveBeenCalledTimes(2)
  })
})
