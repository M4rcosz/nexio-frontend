'use client'

import { useSyncExternalStore } from 'react'
import {
  backendStatus,
  IDLE_SNAPSHOT,
  type BackendStatusSnapshot,
} from '@/lib/backend-status/store'

/** Subscribes to the shared backend wake-state store (see its module doc). */
export function useBackendStatus(): BackendStatusSnapshot {
  return useSyncExternalStore(
    backendStatus.subscribe,
    backendStatus.getSnapshot,
    () => IDLE_SNAPSHOT,
  )
}
