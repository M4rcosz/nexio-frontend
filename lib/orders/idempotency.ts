'use client'

import { useRef } from 'react'

/**
 * Holds a stable `Idempotency-Key` (a `crypto.randomUUID()`) for a create
 * request, so retries of the same submission carry the same key and the backend
 * returns the original order instead of creating a duplicate (doc §4). The key
 * survives re-renders and is only regenerated when `payloadFingerprint`
 * changes — a genuinely different order should get a genuinely new key, and
 * reusing a key with a different body is a real 409.
 *
 * The fingerprint is compared by JSON serialization (the codebase has no
 * deep-equal utility, and it already uses `JSON.stringify` for this kind of
 * dependency keying — see OrderBoard's `depsKey`). Pass the same object shape
 * you send as the request body.
 *
 * Shared by `CheckoutView` and the create-order form(s) so the idempotency
 * story is identical everywhere an order is placed.
 */
export function useIdempotencyKey(payloadFingerprint: unknown): string {
  const fingerprint = JSON.stringify(payloadFingerprint)
  const ref = useRef<{ fingerprint: string; key: string } | null>(null)
  if (!ref.current || ref.current.fingerprint !== fingerprint) {
    ref.current = { fingerprint, key: crypto.randomUUID() }
  }
  return ref.current.key
}
