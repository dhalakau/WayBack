// Vitest global setup. Adds the jest-dom matchers (toBeInTheDocument, etc.) so
// component tests can assert on the rendered DOM. Pure-logic tests do not need
// these, but loading them once here keeps every test file consistent.
import '@testing-library/jest-dom'
