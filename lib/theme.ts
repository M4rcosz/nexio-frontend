import { cookies } from 'next/headers'

export type Theme = 'dark' | 'light'

export const THEME_COOKIE = 'theme'

/**
 * Read the theme cookie on the server. Defaults to 'dark' so first-time
 * visitors land on the dark palette as requested.
 */
export async function getTheme(): Promise<Theme> {
  const store = await cookies()
  const value = store.get(THEME_COOKIE)?.value
  return value === 'light' ? 'light' : 'dark'
}
