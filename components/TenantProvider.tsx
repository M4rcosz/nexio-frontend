'use client'

import { createContext, useContext } from 'react'
import type { TenantBranding } from '@/lib/tenant/config'

const TenantContext = createContext<TenantBranding | null>(null)

export function TenantProvider({
  branding,
  children,
}: {
  branding: TenantBranding
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={branding}>{children}</TenantContext.Provider>
  )
}

/** Access the active tenant's branding from any client component. */
export function useTenant(): TenantBranding {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return ctx
}
