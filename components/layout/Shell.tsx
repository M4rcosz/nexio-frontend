'use client'

import { usePathname } from 'next/navigation'
import {
  headerTier,
  shellClass,
  shellTier,
  type ShellTier,
} from '@/lib/layout/shell'

/**
 * The width-tier wrapper for the app shell (`<main>`, `<footer>`, the header
 * bar).
 *
 * Client-side on purpose: the App Router does not re-render a shared layout on
 * a soft navigation — the RSC payload for `/` → `/login` starts at the page
 * segment — so a tier resolved once on the server would stay stuck at whatever
 * route was hard-loaded first. `usePathname` re-renders on every navigation.
 *
 * `tier` is the server-resolved tier (from the pathname the middleware stamps
 * on the request). `usePathname` is populated during SSR too, so `resolved`
 * — not `tier` — is what actually renders in practice; `tier` only takes over
 * as a fallback for the brief window (if any) where the pathname can't yet
 * be resolved, so there is still no flash and no mismatch.
 */
export function Shell({
  as: Tag = 'div',
  tier,
  clamp = false,
  className = '',
  children,
}: {
  /** Element to render — the shell is chrome, so the tag carries the semantics. */
  as?: 'main' | 'footer' | 'div'
  /** Server-resolved tier; used until the client router knows the pathname. */
  tier: ShellTier
  /** Clamp `prose` up to `content` (the global nav must never shrink). */
  clamp?: boolean
  className?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const resolved = pathname ? shellTier(pathname) : tier
  return (
    <Tag
      className={`${shellClass(clamp ? headerTier(resolved) : resolved)} ${className}`}
    >
      {children}
    </Tag>
  )
}
