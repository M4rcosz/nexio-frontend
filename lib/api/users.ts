// [stub] backend does not implement /users/me yet — always uses mock.
import type { User } from './types'
import { getMeMock } from './mocks/users'
import { getSession } from '@/lib/auth/session'

export async function getMe(): Promise<User> {
  const session = await getSession()
  return getMeMock(session?.sub ?? null)
}
