import { z } from 'zod'

/** Max length of a customer/walk-in name (doc §3). Measured on the trimmed
 * input, before format-character normalization. */
export const CUSTOMER_NAME_MAX_LENGTH = 60

/** At least one letter or digit (any script — `José`, `Ana Sofía` are fine). */
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u

/** Unicode format characters (Cf category: zero-width space U+200B, BOM
 * U+FEFF, and friends). The backend strips these before validating, so we must
 * too — otherwise a name of only invisible characters would pass a naive check. */
const FORMAT_CHARS = /\p{Cf}/gu

/**
 * Mirrors the backend normalization (doc §3): strip Unicode format characters,
 * then trim. The result is what the "has at least one letter or digit" check
 * runs against. Callers that need to *send* a name should send the trimmed raw
 * value; this normalized form is only for the required/empty check.
 */
export function normalizeCustomerName(raw: string): string {
  return raw.replace(FORMAT_CHARS, '').trim()
}

/** Which rule a name violated — maps 1:1 to an i18n message key. `null` = ok. */
export type CustomerNameRule = 'required' | 'too-long'

/**
 * Pure check used for instant client-side feedback (so the user sees the error
 * before the round trip, as the doc asks) and to pick the right i18n key.
 * Length is measured on the trimmed raw input; `"   "`, a zero-width space and
 * `"!!!"` all fail the required check (they normalize to no letter/digit).
 */
export function checkCustomerName(raw: string): CustomerNameRule | null {
  if (raw.trim().length > CUSTOMER_NAME_MAX_LENGTH) return 'too-long'
  if (!HAS_ALPHANUMERIC.test(normalizeCustomerName(raw))) return 'required'
  return null
}

export function isValidCustomerName(raw: string): boolean {
  return checkCustomerName(raw) === null
}

/**
 * Zod form of the name rules for callers that want a schema. It is built on the
 * same normalization/validation primitives ({@link normalizeCustomerName},
 * {@link CUSTOMER_NAME_MAX_LENGTH}, the alphanumeric check) that the
 * `POST /orders` route applies via {@link checkCustomerName} — so the two share
 * the underlying rules rather than this literal schema (the route calls
 * `checkCustomerName` directly). Trims the value and emits the
 * {@link CustomerNameRule} keys as error messages. Use `.optional()` for
 * channels where a name is not always required (COUNTER/PICKUP); TOTEM uses it
 * as-is.
 */
export const customerNameSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length <= CUSTOMER_NAME_MAX_LENGTH, { message: 'too-long' })
  .refine((v) => HAS_ALPHANUMERIC.test(normalizeCustomerName(v)), {
    message: 'required',
  })
