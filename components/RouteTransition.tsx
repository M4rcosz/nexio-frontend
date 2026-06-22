'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps the page content with a fade-in animation that re-fires on every
 * navigation. Keying on `pathname` forces React to unmount/remount the
 * subtree, which restarts the CSS animation defined as `animate-fade-in`.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  )
}
