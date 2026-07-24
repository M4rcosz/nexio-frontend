import type { ReactNode } from 'react'

/**
 * Card wrapper for admin form pages. Caps width at the wrapper level (not
 * inside the reusable `*Form` components, several of which are also used on
 * the `content`-tier `/profile` shell) so a `sm:grid-cols-2` field column
 * doesn't stretch to ~620px under the wider `wide`-tier admin shell.
 */
export function AdminFormCard({ children }: { children: ReactNode }) {
  return <div className="card max-w-3xl p-6">{children}</div>
}
