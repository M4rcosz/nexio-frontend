// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { PasswordInput } from '@/components/ui/PasswordInput'

afterEach(cleanup)

describe('PasswordInput', () => {
  it('renders as a masked password field by default', () => {
    renderWithIntl(<PasswordInput aria-label="pw" defaultValue="secret" />)
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password')
    expect(
      screen.getByRole('button', { name: /show password/i }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles visibility when the eye button is clicked', async () => {
    const user = userEvent.setup()
    renderWithIntl(<PasswordInput aria-label="pw" defaultValue="secret" />)
    await user.click(screen.getByRole('button', { name: /show password/i }))

    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'text')
    const toggle = screen.getByRole('button', { name: /hide password/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(screen.getByLabelText('pw')).toHaveAttribute('type', 'password')
  })

  it('forwards native input props and keeps the toggle out of the tab order', () => {
    renderWithIntl(
      <PasswordInput aria-label="pw" name="password" placeholder="Enter" />,
    )
    const input = screen.getByLabelText('pw')
    expect(input).toHaveAttribute('name', 'password')
    expect(input).toHaveAttribute('placeholder', 'Enter')
    // The toggle never steals focus or submits the surrounding form.
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
