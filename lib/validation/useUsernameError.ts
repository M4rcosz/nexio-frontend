'use client'

import { useTranslations } from 'next-intl'
import { checkUsername, type UsernameRule } from './username'

/** Maps a failing {@link UsernameRule} to its i18n key under `username`. */
const RULE_KEY: Record<UsernameRule, string> = {
  'too-short': 'tooShort',
  'too-long': 'tooLong',
  pattern: 'pattern',
  reserved: 'reserved',
}

/**
 * Hook returning a resolver that turns a username string into a translated
 * validation message (or `null` when valid / empty). Reused by the register and
 * admin-create forms for instant, non-folding feedback.
 */
export function useUsernameError() {
  const t = useTranslations('username')
  return (value: string): string | null => {
    if (value.length === 0) return null
    const rule = checkUsername(value)
    return rule ? t(RULE_KEY[rule]) : null
  }
}
