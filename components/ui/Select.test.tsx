// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select, type SelectOption } from './Select'

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry', disabled: true },
  { value: 'd', label: 'Date' },
]

function renderSelect(
  props: Partial<React.ComponentProps<typeof Select>> = {},
) {
  const onChange = vi.fn()
  render(
    <Select
      value={props.value ?? 'a'}
      onChange={props.onChange ?? onChange}
      options={props.options ?? OPTIONS}
      ariaLabel="Fruit"
      {...props}
    />,
  )
  return { onChange: props.onChange ?? onChange }
}

afterEach(cleanup)

describe('Select', () => {
  it('shows the selected option label on the closed trigger', () => {
    renderSelect({ value: 'b' })
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('falls back to the placeholder when no option matches', () => {
    renderSelect({ value: 'zzz', placeholder: 'Pick one' })
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick one')
  })

  it('opens the listbox on click and marks the selected option', async () => {
    const user = userEvent.setup()
    renderSelect({ value: 'a' })
    await user.click(screen.getByRole('combobox'))
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    const selected = within(listbox).getByRole('option', { selected: true })
    expect(selected).toHaveTextContent('Apple')
  })

  it('selects an option on click and closes', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect({ value: 'a' })
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Banana' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not select a disabled option', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect({ value: 'a' })
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Cherry' }))
    expect(onChange).not.toHaveBeenCalled()
    // Listbox stays open because the click was a no-op.
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('supports keyboard selection, skipping disabled options', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect({ value: 'a' })
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await user.keyboard('{ArrowDown}') // open, highlight stays on selected 'a'
    await user.keyboard('{ArrowDown}') // -> 'b'
    await user.keyboard('{ArrowDown}') // skip disabled 'c' -> 'd'
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('d')
  })

  it('closes on Escape without selecting', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect()
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await user.keyboard('{Enter}') // open
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    renderSelect({ disabled: true })
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Select
          value="a"
          onChange={vi.fn()}
          options={OPTIONS}
          ariaLabel="Fruit"
        />
        <button type="button">outside</button>
      </div>,
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  describe('searchable', () => {
    it('does not render a search input by default', async () => {
      const user = userEvent.setup()
      renderSelect({ value: 'a' })
      await user.click(screen.getByRole('combobox'))
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
    })

    it('filters options as the user types', async () => {
      const user = userEvent.setup()
      renderSelect({ value: 'a', searchable: true })
      await user.click(screen.getByRole('combobox'))
      const search = screen.getByPlaceholderText('Search...')
      expect(search).toHaveFocus()

      await user.type(search, 'an')
      const listbox = screen.getByRole('listbox')
      expect(within(listbox).getAllByRole('option')).toHaveLength(1)
      expect(within(listbox).getByRole('option')).toHaveTextContent('Banana')
    })

    it('shows a message when nothing matches', async () => {
      const user = userEvent.setup()
      renderSelect({ value: 'a', searchable: true })
      await user.click(screen.getByRole('combobox'))
      await user.type(screen.getByPlaceholderText('Search...'), 'zzz')
      expect(screen.queryByRole('option')).not.toBeInTheDocument()
      expect(screen.getByText('No results found.')).toBeInTheDocument()
    })

    it('selects a filtered option and clears the query on reopen', async () => {
      const user = userEvent.setup()
      const { onChange } = renderSelect({ value: 'a', searchable: true })
      await user.click(screen.getByRole('combobox'))
      await user.type(screen.getByPlaceholderText('Search...'), 'ban')
      await user.click(screen.getByRole('option', { name: 'Banana' }))
      expect(onChange).toHaveBeenCalledWith('b')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      await user.click(screen.getByRole('combobox'))
      expect(screen.getByPlaceholderText('Search...')).toHaveValue('')
      expect(
        within(screen.getByRole('listbox')).getAllByRole('option'),
      ).toHaveLength(OPTIONS.length)
    })

    it('navigates and selects filtered results with the keyboard', async () => {
      const user = userEvent.setup()
      const { onChange } = renderSelect({ value: 'a', searchable: true })
      await user.click(screen.getByRole('combobox'))
      const search = screen.getByPlaceholderText('Search...')
      await user.type(search, 'a') // matches Apple, Banana, Date
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
      expect(onChange).toHaveBeenCalledWith('d')
    })

    it('supports custom placeholder and no-results text', async () => {
      const user = userEvent.setup()
      renderSelect({
        value: 'a',
        searchable: true,
        searchPlaceholder: 'Find a fruit',
        noResultsLabel: 'Nothing here',
      })
      await user.click(screen.getByRole('combobox'))
      await user.type(screen.getByPlaceholderText('Find a fruit'), 'zzz')
      expect(screen.getByText('Nothing here')).toBeInTheDocument()
    })
  })
})
