// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderWithIntl } from '@/lib/test/intl'
import { UserStatusBadge } from './UserStatusBadge'

afterEach(cleanup)

describe('UserStatusBadge', () => {
  it('renders the active label with the success chip', () => {
    const { container } = renderWithIntl(<UserStatusBadge active />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(container.querySelector('.chip-success')).not.toBeNull()
  })

  it('renders the inactive label with the neutral chip', () => {
    const { container } = renderWithIntl(<UserStatusBadge active={false} />)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(container.querySelector('.chip-success')).toBeNull()
  })
})
