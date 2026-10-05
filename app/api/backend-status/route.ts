import { NextResponse } from 'next/server'
import { checkBackendHealth } from '@/lib/api/health'

// Read-only probe — nothing to revalidate. Same-origin so the browser never
// talks to the backend directly (no CORS / CSP connect-src to widen), and a
// call here is itself what starts waking a sleeping instance.
export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await checkBackendHealth()
  return NextResponse.json(
    { status },
    { headers: { 'cache-control': 'no-store' } },
  )
}
