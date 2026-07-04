/**
 * Where each role should land right after signing in (when no explicit
 * `?redirect=` target was requested).
 *
 * Today only the admin area exists, and it is shared by ADMIN and MANAGER.
 * KITCHEN and ATTENDANT will get their own dashboards later (backlog); until
 * then they fall back to the storefront home. CUSTOMER also lands on home.
 *
 * Pure function (no server-only imports) so it can run on both the login route
 * and the client LoginForm.
 */
export function landingPathForRole(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
    case 'MANAGER':
      return '/admin'
    // TODO(backlog): '/kitchen' for KITCHEN, '/counter' for ATTENDANT once
    // those dashboards exist.
    default:
      return '/'
  }
}
