// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'

afterEach(cleanup)

describe('PasswordStrengthMeter', () => {
  it('shows only the requirement hint (no meter) when empty', () => {
    renderWithIntl(<PasswordStrengthMeter password="" />)
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('labels a weak password and keeps the requirement hint', () => {
    renderWithIntl(<PasswordStrengthMeter password="aaaa" />)
    expect(screen.getByRole('status')).toHaveTextContent(/weak/i)
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
  })

  it('labels a fair password (2 classes, still invalid)', () => {
    renderWithIntl(<PasswordStrengthMeter password="Abcdefgh" />)
    expect(screen.getByRole('status')).toHaveTextContent(/fair/i)
  })

  it('labels a valid 3-class password as good and drops the hint', () => {
    renderWithIntl(<PasswordStrengthMeter password="Abcdefgh12" />)
    expect(screen.getByRole('status')).toHaveTextContent(/good/i)
    expect(
      screen.queryByText(/at least 10 characters/i),
    ).not.toBeInTheDocument()
  })

  it('labels a full 4-class password as strong', () => {
    renderWithIntl(<PasswordStrengthMeter password="Abcdefg1!x" />)
    expect(screen.getByRole('status')).toHaveTextContent(/strong/i)
  })
})
