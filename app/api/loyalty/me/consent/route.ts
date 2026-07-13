import { NextResponse } from 'next/server'
import { giveLoyaltyConsent, revokeLoyaltyConsent } from '@/lib/api/loyalty'
import { describeError } from '@/lib/api/errors'
import { isAuthenticated } from '@/lib/auth/session'

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  try {
    const account = await giveLoyaltyConsent()
    return NextResponse.json(account)
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 })
  }
}

export async function DELETE() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  try {
    const account = await revokeLoyaltyConsent()
    if (!account) {
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
