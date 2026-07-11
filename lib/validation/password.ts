import { z } from 'zod'
import {
  PASSWORD_LOGIN_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './constants'

/** The four character classes a strong password is scored against. */
const CLASS_PATTERNS = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]

export type PasswordScore = {
  /** Number of distinct character classes present (0–4). */
  classes: number
  /** True when length is within bounds and ≥3 of 4 classes are present. */
  valid: boolean
}

/**
 * Pure scorer reused by the strength meter and the strong schema. A password is
 * valid when it has at least {@link PASSWORD_MIN_LENGTH} characters (and no more
 * than {@link PASSWORD_MAX_LENGTH}) and covers at least 3 of the 4 classes.
 */
export function scorePassword(pw: string): PasswordScore {
  const classes = CLASS_PATTERNS.filter((re) => re.test(pw)).length
  const valid =
    pw.length >= PASSWORD_MIN_LENGTH &&
    pw.length <= PASSWORD_MAX_LENGTH &&
    classes >= 3
  return { classes, valid }
}

/** Strong schema for registration / admin-create / change-password. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'too-short')
  .max(PASSWORD_MAX_LENGTH, 'too-long')
  .refine((v) => scorePassword(v).classes >= 3, 'complexity')

/** Lenient login schema: length only, no complexity requirement. */
export const loginPasswordSchema = z
  .string()
  .min(PASSWORD_LOGIN_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
