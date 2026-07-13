import type { ReactElement, ReactNode } from 'react'
import { render, renderHook, type RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/en.json'

const LOCALE = 'en'

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={LOCALE} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

/**
 * Render a component inside the real English message catalog, so translated
 * copy in assertions matches what users actually see. Test-only helper — keeps
 * every component/hook suite from re-wiring the intl provider.
 */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options })
}

/** renderHook counterpart of {@link renderWithIntl}. */
export function renderHookWithIntl<Result, Props>(
  hook: (initialProps: Props) => Result,
) {
  return renderHook(hook, { wrapper: Providers })
}
