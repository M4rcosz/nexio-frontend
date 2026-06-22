import { headers } from 'next/headers'
import {
  DEFAULT_TENANT_ID,
  TENANTS,
  getTenantById,
  type Tenant,
} from './config'

/**
 * Resolve the active tenant for the current request.
 *
 * Resolution order (most specific first):
 *   1. Subdomain — `acme.app.com` → tenant "acme"
 *   2. NEXT_PUBLIC_TENANT env var (single-tenant deployments / local dev)
 *   3. Default tenant
 */
export async function getTenant(): Promise<Tenant> {
  try {
    const store = await headers()
    const host = store.get('host') ?? ''
    const sub = host.split(':')[0]?.split('.')[0] ?? ''
    if (sub && TENANTS[sub]) return TENANTS[sub]
  } catch {
    /* headers() not available (e.g. static context) — fall through */
  }

  const envTenant = process.env.NEXT_PUBLIC_TENANT
  if (envTenant && TENANTS[envTenant]) return TENANTS[envTenant]

  return getTenantById(DEFAULT_TENANT_ID)
}
