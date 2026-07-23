// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { DatePicker, parseISODate, toISODate } from './DatePicker'

// Fixed "today" so the grid, the Today button and the highlighted cell are
// deterministic. 2026-06-24 is a Wednesday.
const TODAY = new Date(2026, 5, 24, 9, 30)

function renderPicker(
  props: Partial<React.ComponentProps<typeof DatePicker>> = {},
) {
  const onChange = props.onChange ?? vi.fn()
  renderWithIntl(
    <DatePicker
      value={props.value ?? ''}
      onChange={onChange}
      ariaLabel="From"
      {...props}
    />,
  )
  return { onChange }
}

/** Opens the popover and returns its grid. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'From' }))
  return screen.getByRole('grid')
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('parseISODate / toISODate', () => {
  it('round-trips a local calendar date', () => {
    const date = parseISODate('2026-06-24')!
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(24)
    expect(toISODate(date)).toBe('2026-06-24')
  })

  it('rejects malformed and overflowing dates', () => {
    expect(parseISODate('')).toBeNull()
    expect(parseISODate('24/06/2026')).toBeNull()
    // Would silently roll into March if we trusted the Date constructor.
    expect(parseISODate('2026-02-31')).toBeNull()
  })
})

describe('DatePicker', () => {
  it('shows the placeholder while empty and the locale-formatted value once set', () => {
    const { rerender } = renderWithIntl(
      <DatePicker value="" onChange={vi.fn()} ariaLabel="From" />,
    )
    expect(screen.getByRole('button', { name: 'From' })).toHaveTextContent(
      'Select a date',
    )
    rerender(
      <DatePicker value="2026-06-24" onChange={vi.fn()} ariaLabel="From" />,
    )
    expect(screen.getByRole('button', { name: 'From' })).toHaveTextContent(
      '06/24/2026',
    )
  })

  it('opens on the selected value’s month and marks that day selected', async () => {
    const user = userEvent.setup()
    renderPicker({ value: '2026-03-09' })
    const grid = await open(user)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('From')
    expect(grid).toHaveAccessibleName('March 2026')
    expect(
      within(grid).getByRole('gridcell', { selected: true }),
    ).toHaveTextContent('9')
  })

  it('falls back to the current month when there is no value', async () => {
    const user = userEvent.setup()
    renderPicker()
    expect(await open(user)).toHaveAccessibleName('June 2026')
    expect(
      screen.getByRole('button', { name: 'Wednesday, June 24, 2026' }),
    ).toHaveAttribute('aria-current', 'date')
  })

  it('emits YYYY-MM-DD on click and closes', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({ value: '2026-06-24' })
    await open(user)
    await user.click(screen.getByRole('button', { name: /June 11, 2026/ }))
    expect(onChange).toHaveBeenCalledWith('2026-06-11')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pages months without emitting a value', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({ value: '2026-01-15' })
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('grid')).toHaveAccessibleName('December 2025')
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('grid')).toHaveAccessibleName('February 2026')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves the cursor with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({ value: '2026-06-24' })
    await open(user)
    // Focus lands on the selected day; one row down, one column left.
    await user.keyboard('{ArrowDown}{ArrowLeft}{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-06-30')
  })

  it('crosses the month boundary with the arrow keys', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({ value: '2026-06-01' })
    await open(user)
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('grid')).toHaveAccessibleName('May 2026')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-05-31')
  })

  it('disables days outside min/max', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({
      value: '2026-06-24',
      min: '2026-06-10',
      max: '2026-06-20',
    })
    await open(user)
    expect(screen.getByRole('button', { name: /June 9, 2026/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /June 10, 2026/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /June 21, 2026/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the value and offers Today', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({ value: '2026-06-11' })
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith('')

    renderPicker({ value: '', onChange })
    await user.click(screen.getAllByRole('button', { name: 'From' })[1])
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onChange).toHaveBeenCalledWith('2026-06-24')
  })

  it('hides Clear while empty', async () => {
    const user = userEvent.setup()
    renderPicker({ value: '' })
    await open(user)
    expect(
      screen.queryByRole('button', { name: 'Clear' }),
    ).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderPicker({ value: '2026-06-24' })
    await open(user)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'From' })).toHaveFocus()
  })

  it('closes on an outside click', async () => {
    const user = userEvent.setup()
    renderPicker()
    await open(user)
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not open while disabled', async () => {
    const user = userEvent.setup()
    renderPicker({ disabled: true })
    await user.click(screen.getByRole('button', { name: 'From' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
