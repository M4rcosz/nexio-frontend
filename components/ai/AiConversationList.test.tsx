// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/lib/test/intl'
import { AiConversationList } from './AiConversationList'
import type { AiConversationSummary } from '@/lib/api/types'

function thread(
  over: Partial<AiConversationSummary> = {},
): AiConversationSummary {
  return {
    id: 'c1',
    title: 'Where is my order?',
    isDeleted: false,
    createdAt: '2026-07-23T18:15:00Z',
    updatedAt: '2026-07-23T18:16:00Z',
    ...over,
  }
}

function setup(over: Partial<Parameters<typeof AiConversationList>[0]> = {}) {
  const onDelete = vi.fn()
  const onRename = vi.fn()
  const onSearchChange = vi.fn()
  renderWithIntl(
    <AiConversationList
      threads={[thread()]}
      activeId={null}
      hasMore={false}
      loading={false}
      error={null}
      searchTerm=""
      searching={false}
      onSearchChange={onSearchChange}
      onOpen={vi.fn()}
      onRename={onRename}
      onDelete={onDelete}
      onNewChat={vi.fn()}
      onLoadMore={vi.fn()}
      busy={false}
      {...over}
    />,
  )
  return { onDelete, onRename, onSearchChange }
}

afterEach(cleanup)

describe('AiConversationList thread menu', () => {
  it('hides the delete action until the menu is opened', async () => {
    setup()
    expect(
      screen.queryByRole('menuitem', { name: /delete conversation/i }),
    ).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    expect(
      screen.getByRole('menuitem', { name: /delete conversation/i }),
    ).toBeInTheDocument()
  })

  it('reports its expanded state and moves focus into the menu', async () => {
    setup()
    const trigger = screen.getByRole('button', {
      name: /conversation options/i,
    })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // Focus lands on the first item, which is now Rename (Delete sits below it).
    expect(screen.getByRole('menuitem', { name: /rename/i })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    setup()
    const trigger = screen.getByRole('button', {
      name: /conversation options/i,
    })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  // `RouteTransition` wraps every page in an element that animates `transform`,
  // which would become the containing block of a merely `fixed` panel and
  // offset it by the page container. Only escaping to <body> keeps it anchored.
  it('renders the panel outside the list, on the document body', async () => {
    setup()
    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    const menu = screen.getByRole('menu')
    expect(menu.parentElement).toBe(document.body)
    expect(menu.closest('section')).toBeNull()
  })

  it('closes when clicking outside', async () => {
    setup()
    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('still confirms before deleting, and only then calls onDelete', async () => {
    const { onDelete } = setup()
    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    await userEvent.click(
      screen.getByRole('menuitem', { name: /delete conversation/i }),
    )

    // The menu gives way to the confirm dialog — nothing is deleted yet.
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onDelete).not.toHaveBeenCalled()

    const dialog = screen.getByRole('alertdialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: /delete conversation/i }),
    )
    expect(onDelete).toHaveBeenCalledWith('c1')
  })

  it('cancelling the confirm leaves the thread alone', async () => {
    const { onDelete } = setup()
    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    await userEvent.click(
      screen.getByRole('menuitem', { name: /delete conversation/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('disables the menu while a send or thread load is in flight', () => {
    setup({ busy: true })
    expect(
      screen.getByRole('button', { name: /conversation options/i }),
    ).toBeDisabled()
  })
})

describe('AiConversationList row content', () => {
  it('renders the title as clamped text with the full value on the tooltip', () => {
    setup({ threads: [thread({ title: 'Refund for order #42' })] })
    const title = screen.getByText('Refund for order #42')
    // Rendered as text (not HTML), clamped with `truncate`, full value on title.
    expect(title).toHaveClass('truncate')
    expect(title).toHaveAttribute('title', 'Refund for order #42')
  })

  it('shows the last-activity date as the secondary line', () => {
    setup({ threads: [thread({ updatedAt: '2026-07-23T18:16:00Z' })] })
    // Some localized rendering of the year is present under the title.
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })
})

describe('AiConversationList search', () => {
  it('reports each keystroke to onSearchChange', async () => {
    const { onSearchChange } = setup()
    const box = screen.getByRole('searchbox', {
      name: /search conversations by title/i,
    })
    await userEvent.type(box, 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')
  })

  it('shows the search-specific empty copy when a term yields no rows', () => {
    setup({ threads: [], searchTerm: 'zzz', searching: false })
    expect(
      screen.getByText(/no conversations match your search/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/send a message to start one/i)).toBeNull()
  })

  it('shows the default empty copy with no search term', () => {
    setup({ threads: [], searchTerm: '', searching: false })
    expect(screen.getByText(/send a message to start one/i)).toBeInTheDocument()
  })

  it('holds the empty state (no copy) while a search is resolving', () => {
    setup({ threads: [], searchTerm: 'zzz', searching: true })
    expect(screen.queryByText(/no conversations match your search/i)).toBeNull()
    expect(screen.queryByText(/send a message to start one/i)).toBeNull()
  })
})

describe('AiConversationList inline rename', () => {
  async function openRename() {
    await userEvent.click(
      screen.getByRole('button', { name: /conversation options/i }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
    return screen.getByRole('textbox', { name: /conversation title/i })
  }

  it('opens an inline editor prefilled with the current title', async () => {
    setup({ threads: [thread({ title: 'Old title' })] })
    const input = await openRename()
    expect(input).toHaveValue('Old title')
  })

  it('shows a live code-point counter as the value changes', async () => {
    setup({ threads: [thread({ title: 'hi' })] })
    const input = await openRename()
    expect(screen.getByText('2/80')).toBeInTheDocument()
    await userEvent.type(input, 'ya')
    expect(screen.getByText('4/80')).toBeInTheDocument()
  })

  it('disables Save when the title exceeds 80 code points (counting emoji as one)', async () => {
    setup()
    const input = await openRename()
    await userEvent.clear(input)
    // 81 cacti — each a surrogate pair, so `.length` would read 162.
    await userEvent.paste('🌵'.repeat(81))
    expect(screen.getByText('81/80')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('keeps Save enabled at exactly 80 emoji', async () => {
    setup()
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.paste('🌵'.repeat(80))
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })

  it('saves on Enter with the edited title', async () => {
    const { onRename } = setup({ threads: [thread({ title: 'before' })] })
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.type(input, 'after{Enter}')
    expect(onRename).toHaveBeenCalledWith('c1', 'after')
  })

  it('saves when the Save button is clicked with the mouse', async () => {
    const { onRename } = setup({ threads: [thread({ title: 'before' })] })
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.type(input, 'after')
    // The button suppresses the mousedown focus shift, so the click's blur
    // does not cancel the edit before it lands (macOS Safari/Firefox path).
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onRename).toHaveBeenCalledWith('c1', 'after')
  })

  it('counts the trimmed value and keeps Save enabled at 80 + trailing space', async () => {
    setup()
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.paste(`${'x'.repeat(80)} `)
    // Trimmed length is 80, not 81 — no red 81/80, and Save stays enabled.
    expect(screen.getByText('80/80')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
  })

  it('exposes invalidity to assistive tech when over the cap', async () => {
    setup()
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.paste('🌵'.repeat(81))

    expect(input).toHaveAttribute('aria-invalid', 'true')
    // The counter and the invalid message are both wired into the description.
    const describedby = input.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(describedby).toHaveLength(2)
    const message = screen.getByText(/title must be 1[–-]80 characters/i)
    expect(describedby).toContain(message.getAttribute('id'))
  })

  it('marks a valid title as aria-invalid=false with a single describer', async () => {
    setup({ threads: [thread({ title: 'valid title' })] })
    const input = await openRename()
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(1)
  })

  it('cancels on Escape without calling onRename', async () => {
    const { onRename } = setup({ threads: [thread({ title: 'keep me' })] })
    const input = await openRename()
    await userEvent.clear(input)
    await userEvent.type(input, 'discarded{Escape}')
    expect(onRename).not.toHaveBeenCalled()
    // The editor is gone and the original row is back.
    expect(
      screen.queryByRole('textbox', { name: /conversation title/i }),
    ).toBeNull()
    expect(screen.getByText('keep me')).toBeInTheDocument()
  })
})
