import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/api/client'

export type SessionPayload = {
  sub: string
  username: string
  role: string
  /** Units the staff user is bound to ([] = unbound). Absent in old tokens. */
  businessUnitIds?: string[]
  iat?: number
  exp?: number
}

function decodePayload(token: string): SessionPayload | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part, 'base64url').toString('utf8')
    return JSON.parse(json) as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = decodePayload(token)
  if (!payload) return null
  if (payload.exp && payload.exp * 1000 < Date.now()) return null
  return payload
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null
}
