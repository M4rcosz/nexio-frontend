'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  ariaLabel?: string
  id?: string
  placeholder?: string
  disabled?: boolean
  /** Classes on the trigger button. Defaults to the `.input` look. */
  className?: string
  /** Optional leading node (e.g. an icon) rendered inside the trigger. */
  leading?: React.ReactNode
  /** Popover alignment relative to the trigger. */
  align?: 'start' | 'end'
  /** Trigger fills its container (matches the old full-width `<select>`). */
  fullWidth?: boolean
  /**
   * Show a text filter at the top of the popover. Use for long option lists
   * (business units, etc.) where scrolling a flat list doesn't scale.
   */
  searchable?: boolean
  /** Placeholder for the search input, shown when `searchable` is set. */
  searchPlaceholder?: string
  /** Message shown when the search filter matches no options. */
  noResultsLabel?: string
}

/**
 * Themed, accessible dropdown that replaces the native `<select>` — the native
 * option list can't be styled, so it ignored our light/dark theme. This renders
 * its own popover (listbox) using theme tokens, with full keyboard support.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  placeholder,
  disabled = false,
  className = 'input',
  leading,
  align = 'start',
  fullWidth = true,
  searchable = false,
  searchPlaceholder = 'Search...',
  noResultsLabel = 'No results found.',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const reactId = useId()
  const baseId = id ?? reactId

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  const filteredOptions =
    searchable && query.trim()
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  // Reset the filter and focus it whenever the popover opens.
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    if (searchable) searchInputRef.current?.focus()
  }, [open, searchable])

  // Re-clamp the highlight whenever the filtered list changes.
  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(filteredOptions.length - 1, 0)))
  }, [filteredOptions.length])

  function openMenu() {
    if (disabled) return
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function commit(index: number) {
    const opt = filteredOptions[index]
    if (!opt || opt.disabled) return
    onChange(opt.value)
    setOpen(false)
  }

  function moveHighlight(dir: 1 | -1) {
    setHighlight((h) => {
      let next = h
      for (let i = 0; i < filteredOptions.length; i++) {
        next = (next + dir + filteredOptions.length) % filteredOptions.length
        if (!filteredOptions[next]?.disabled) break
      }
      return next
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveHighlight(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveHighlight(-1)
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(filteredOptions.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        commit(highlight)
        break
      case ' ':
        // A space in the search field should filter, not select.
        if (!searchable) {
          e.preventDefault()
          commit(highlight)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}
    >
      <button
        type="button"
        id={baseId}
        role="combobox"
        disabled={disabled}
        aria-controls={open ? `${baseId}-listbox` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${baseId}-opt-${highlight}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {leading}
        <span className={`flex-1 truncate ${selected ? '' : 'text-fg-subtle'}`}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          className={`absolute z-50 mt-2 min-w-full overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-soft-lg ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {searchable ? (
            <div className="border-b border-border p-1.5">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={`${baseId}-listbox`}
                aria-activedescendant={
                  filteredOptions.length
                    ? `${baseId}-opt-${highlight}`
                    : undefined
                }
                className="input"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={`${baseId}-listbox`}
            role="listbox"
            tabIndex={-1}
            className="scrollbar-thin max-h-64 overflow-auto p-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-fg-subtle">
                {noResultsLabel}
              </li>
            ) : (
              filteredOptions.map((opt, i) => {
                const isSelected = opt.value === value
                const isActive = i === highlight
                return (
                  <li
                    key={opt.value}
                    id={`${baseId}-opt-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => commit(i)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      opt.disabled ? 'pointer-events-none opacity-40' : ''
                    } ${
                      isSelected
                        ? 'font-semibold text-brand-700 dark:text-brand-300'
                        : 'text-fg'
                    } ${isActive ? 'bg-surface-2' : ''}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? (
                      <CheckIcon className="h-4 w-4 flex-none text-brand-500" />
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
