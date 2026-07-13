import { NextResponse } from 'next/server'
import { getMyLoyalty } from '@/lib/api/loyalty'
import { describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  try {
    const account = await getMyLoyalty()
    if (!account) {
      // Account does not exist yet — created on first order / consent.
      return NextResponse.json(
        { error: 'No loyalty account.' },
        { status: 404 },
      )
    }
    return NextResponse.json(account)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}
