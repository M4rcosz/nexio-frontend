/**
 * Where each role should land right after signing in (when no explicit
 * `?redirect=` target was requested).
 *
 * ADMIN/MANAGER share the admin area; ATTENDANT lands on the POS order-entry
 * surface. KITCHEN has no dashboard yet (backlog) and falls back to the
 * storefront home, same as CUSTOMER.
 *
 * Pure function (no server-only imports) so it can run on both the login route
 * and the client LoginForm.
 */
export function landingPathForRole(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
    case 'MANAGER':
      return '/admin'
    case 'ATTENDANT':
      return '/pos'
    // TODO(backlog): '/kitchen' for KITCHEN once that dashboard exists.
    default:
      return '/'
  }
}
