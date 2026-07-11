import { z } from 'zod'
import {
  RESERVED_USERNAMES,
  USERNAME_LOGIN_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from './constants'

/** Which rule a username violated — maps 1:1 to an i18n message key. */
export type UsernameRule = 'too-short' | 'too-long' | 'pattern' | 'reserved'

/**
 * Pure, dependency-free check used for instant form feedback and to pick the
 * right i18n key. Returns the first failing rule, or `null` when the username is
 * valid. Order matters: length → format → reserved, so an uppercase input fails
 * on `pattern` (never folded to lowercase and never mistaken for `reserved`).
 */
export function checkUsername(value: string): UsernameRule | null {
  if (value.length < USERNAME_MIN_LENGTH) return 'too-short'
  if (value.length > USERNAME_MAX_LENGTH) return 'too-long'
  if (!USERNAME_PATTERN.test(value)) return 'pattern'
  if (RESERVED_USERNAMES.has(value)) return 'reserved'
  return null
}

/**
 * Strict username schema for registration / admin-create. The error strings are
 * the {@link UsernameRule} keys so a caller can translate them directly.
 */
export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, 'too-short')
  .max(USERNAME_MAX_LENGTH, 'too-long')
  .regex(USERNAME_PATTERN, 'pattern')
  .refine((v) => !RESERVED_USERNAMES.has(v), 'reserved')

/**
 * Lenient username schema for login: trim only, bounded length, no format or
 * reserved rules (a legacy account may not match the current pattern).
 */
export const loginUsernameSchema = z
  .string()
  .trim()
  .min(1, 'Username is required.')
  .max(USERNAME_LOGIN_MAX_LENGTH)
