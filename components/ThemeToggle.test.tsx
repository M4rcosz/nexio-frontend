// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  document.cookie = 'theme=; path=/; max-age=0'
})

afterEach(cleanup)

describe('ThemeToggle', () => {
  it('reflects the initial theme in its accessible label', () => {
    renderWithIntl(<ThemeToggle initial="light" />)
    expect(
      screen.getByRole('button', { name: /switch to dark theme/i }),
    ).toBeInTheDocument()
  })

  it('adds the "dark" class and persists the cookie when starting dark', () => {
    renderWithIntl(<ThemeToggle initial="dark" />)
    expect(document.documentElement).toHaveClass('dark')
    expect(document.cookie).toContain('theme=dark')
  })

  it('toggles the root class and cookie on click', async () => {
    const user = userEvent.setup()
    renderWithIntl(<ThemeToggle initial="light" />)
    expect(document.documentElement).not.toHaveClass('dark')

    await user.click(screen.getByRole('button'))
    expect(document.documentElement).toHaveClass('dark')
    expect(document.cookie).toContain('theme=dark')
    // Label flips to the opposite action.
    expect(
      screen.getByRole('button', { name: /switch to light theme/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.cookie).toContain('theme=light')
  })
})
