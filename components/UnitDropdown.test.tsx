// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'

const replace = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}))

import { UnitDropdown } from './UnitDropdown'

const units = [
  { id: 'bu-1', name: 'Downtown', city: 'Metropolis' },
  { id: 'bu-2', name: 'Airport', city: 'Gotham' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('UnitDropdown', () => {
  it('shows the selected unit label', () => {
    renderWithIntl(<UnitDropdown units={units} selectedId="bu-2" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Airport · Gotham')
  })

  it('drives the ?unit query param when a unit is picked', async () => {
    const user = userEvent.setup()
    renderWithIntl(<UnitDropdown units={units} selectedId="bu-1" />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /airport/i }))

    expect(replace).toHaveBeenCalledWith('/?unit=bu-2', { scroll: false })
  })
})
