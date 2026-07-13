// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) on
// vitest's `expect`. Only extends the matcher set — safe to load in the node
// runtime too; the DOM matchers are just never called there.
import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrollIntoView; components that call it (e.g. the
// Select popover keeping the active option in view) would throw. Provide a
// no-op. Guarded so this is skipped in the node runtime where Element is absent.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
