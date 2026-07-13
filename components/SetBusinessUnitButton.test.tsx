// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { useCartStore } from '@/lib/cart/store'

const push = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push }),
}))

import { SetBusinessUnitButton } from './SetBusinessUnitButton'

beforeEach(() => {
  vi.clearAllMocks()
  useCartStore.getState().clear()
})

afterEach(cleanup)

describe('SetBusinessUnitButton', () => {
  it('sets the cart business unit and navigates to the unit page', async () => {
    const user = userEvent.setup()
    renderWithIntl(<SetBusinessUnitButton id="bu-1" name="Downtown" />)

    await user.click(screen.getByRole('button', { name: /select/i }))

    expect(useCartStore.getState().businessUnitId).toBe('bu-1')
    expect(useCartStore.getState().businessUnitName).toBe('Downtown')
    expect(push).toHaveBeenCalledWith('/units/bu-1')
  })
})
