import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'pt-BR'],
  defaultLocale: 'en',
  // EN no path raiz "/", PT-BR fica em "/pt-BR/..."
  localePrefix: 'as-needed',
})

export type AppLocale = (typeof routing.locales)[number]
