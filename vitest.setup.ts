// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) on
// vitest's `expect`. Only extends the matcher set — safe to load in the node
// runtime too; the DOM matchers are just never called there.
import '@testing-library/jest-dom/vitest'
