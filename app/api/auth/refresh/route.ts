// [stub] backend does not implement /auth/refresh yet. For now this endpoint
// just answers 501 to make the missing feature explicit — see briefing §4.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Refresh is not implemented on the backend yet.' },
    { status: 501 },
  )
}
