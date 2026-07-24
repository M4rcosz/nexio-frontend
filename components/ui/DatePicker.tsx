'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

/**
 * Parses a `YYYY-MM-DD` value into a local date pinned to **noon**.
 *
 * Noon, not midnight: some timezones (Brazil's old DST rules among them) skip
 * 00:00 on transition days, so a midnight anchor silently lands on the previous
 * day. Every date in this file carries that noon anchor, which also makes
 * `<`/`>` comparisons between two of them pure calendar comparisons.
 */
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(year, month - 1, day, 12)
  // Rejects overflow dates such as 2026-02-31, which the Date constructor
  // would happily roll forward into March.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/** Local calendar date → `YYYY-MM-DD` (never via `toISOString`, which is UTC). */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear()).padStart(4, '0')}-${month}-${day}`
}

/** Noon-anchored date, with day arithmetic that rolls months/years for free. */
function at(date: Date, dayOffset = 0): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    12,
  )
}

/** Same day-of-month `offset` months away, clamped to the target month's end. */
function addMonths(date: Date, offset: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1, 12)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
    12,
  ).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * First weekday of the locale's week as a JS `getDay()` index (0 = Sunday).
 * `getWeekInfo` is not in every runtime yet, so an unsupported locale falls
 * back to Sunday — correct for both catalogs we ship (en, pt-BR).
 */
function firstWeekdayFor(locale: string): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    // ICU numbers weekdays 1–7 as Monday–Sunday; `% 7` maps that onto getDay().
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
    return typeof firstDay === 'number' ? firstDay % 7 : 0
  } catch {
    return 0
  }
}

/** The 6×7 block of days covering `month`, padded with its neighbours' days. */
function buildWeeks(month: Date, firstWeekday: number): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const lead = (first.getDay() - firstWeekday + 7) % 7
  const start = at(first, -lead)
  // Always six rows: a shorter grid makes the popover jump in height as the
  // user pages through months.
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => at(start, week * 7 + day)),
  )
}

type DatePickerProps = {
  /** `YYYY-MM-DD`, or `''` when empty — same value shape as `<input type="date">`. */
  value: string
  onChange: (value: string) => void
  /** Inclusive `YYYY-MM-DD` bounds. Days outside them cannot be picked. */
  min?: string
  max?: string
  id?: string
  ariaLabel?: string
  /** Text on the trigger while no date is set. Defaults to the locale pattern. */
  placeholder?: string
  disabled?: boolean
  /** Classes on the trigger button. Defaults to the `.input` look. */
  className?: string
  /** Popover alignment relative to the trigger. */
  align?: 'start' | 'end'
  /** Trigger fills its container (matches the old full-width date input). */
  fullWidth?: boolean
  /** Offer a "Clear" action in the popover footer. */
  clearable?: boolean
}

/**
 * Themed date picker that replaces `<input type="date">`. The native control
 * paints its calendar glyph and its whole dropdown with browser colours we
 * can't reach, so on the dark theme it was all but invisible — this renders
 * the trigger and the calendar from theme tokens, with full keyboard support.
 *
 * Values stay in the `YYYY-MM-DD` shape the native input used, so callers that
 * already convert that to an instant keep working unchanged.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  ariaLabel,
  placeholder,
  disabled = false,
  className = 'input',
  align = 'start',
  fullWidth = true,
  clearable = true,
}: DatePickerProps) {
  const t = useTranslations('common.datePicker')
  const locale = useLocale()
  const reactId = useId()
  const baseId = id ?? reactId

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLTableElement>(null)

  const [open, setOpen] = useState(false)

  const selected = useMemo(() => parseISODate(value), [value])
  const minDate = useMemo(() => (min ? parseISODate(min) : null), [min])
  const maxDate = useMemo(() => (max ? parseISODate(max) : null), [max])
  // Captured once per mount: "today" only has to be right for the session, and
  // re-reading the clock on every render would churn the memoised grid.
  const today = useMemo(() => at(new Date()), [])

  // The day the arrow keys sit on. Its month is also the month on screen, so
  // paging and cursor movement can't disagree with each other.
  const [cursor, setCursor] = useState<Date>(() => selected ?? today)

  // Only keyboard navigation and opening should pull DOM focus into the grid —
  // clicking the month arrows must leave focus on the arrow being clicked.
  const pullFocusRef = useRef(false)

  const firstWeekday = useMemo(() => firstWeekdayFor(locale), [locale])
  const weeks = useMemo(
    () => buildWeeks(cursor, firstWeekday),
    [cursor, firstWeekday],
  )

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(cursor),
    [locale, cursor],
  )

  const weekdays = useMemo(() => {
    const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    // Any week works as a source of weekday names — 2024-01-07 was a Sunday.
    const sunday = new Date(2024, 0, 7, 12)
    return Array.from({ length: 7 }, (_, i) => {
      const day = at(sunday, (firstWeekday + i) % 7)
      return { narrow: narrow.format(day), long: long.format(day) }
    })
  }, [locale, firstWeekday])

  const dayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  )
  const triggerLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [locale],
  )

  function isOutOfRange(day: Date): boolean {
    return Boolean((minDate && day < minDate) || (maxDate && day > maxDate))
  }

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

  // Roving tabindex: the one focusable day follows the cursor.
  useEffect(() => {
    if (!open || !pullFocusRef.current) return
    pullFocusRef.current = false
    gridRef.current
      ?.querySelector<HTMLButtonElement>('[data-cursor="true"]')
      ?.focus()
  }, [open, cursor])

  // An externally changed value (a Reset button, a form load) re-seats the
  // cursor so the next open lands on the month that value belongs to.
  useEffect(() => {
    if (!open) setCursor(selected ?? today)
  }, [open, selected, today])

  function openPicker() {
    if (disabled) return
    setCursor(selected ?? today)
    pullFocusRef.current = true
    setOpen(true)
  }

  function closePicker(restoreFocus = true) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function commit(day: Date) {
    if (isOutOfRange(day)) return
    onChange(toISODate(day))
    closePicker()
  }

  function moveCursor(next: Date) {
    pullFocusRef.current = true
    setCursor(next)
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        moveCursor(at(cursor, -1))
        break
      case 'ArrowRight':
        e.preventDefault()
        moveCursor(at(cursor, 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        moveCursor(at(cursor, -7))
        break
      case 'ArrowDown':
        e.preventDefault()
        moveCursor(at(cursor, 7))
        break
      case 'Home':
        e.preventDefault()
        moveCursor(at(cursor, -((cursor.getDay() - firstWeekday + 7) % 7)))
        break
      case 'End':
        e.preventDefault()
        moveCursor(at(cursor, 6 - ((cursor.getDay() - firstWeekday + 7) % 7)))
        break
      case 'PageUp':
        e.preventDefault()
        moveCursor(addMonths(cursor, e.shiftKey ? -12 : -1))
        break
      case 'PageDown':
        e.preventDefault()
        moveCursor(addMonths(cursor, e.shiftKey ? 12 : 1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        commit(cursor)
        break
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          e.stopPropagation()
          closePicker()
        }
      }}
      // Tab is not trapped inside the calendar, so a Tab off the last control
      // would otherwise leave the popover open on top of whatever sits beneath
      // it (e.g. the adjacent "To" trigger). Close when focus leaves the root —
      // without pulling it back, since it has already legitimately moved on.
      onBlur={(e) => {
        if (!open) return
        const next = e.relatedTarget as Node | null
        if (next && rootRef.current?.contains(next)) return
        closePicker(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? closePicker(false) : openPicker())}
        className={`flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-fg-muted" />
        <span className={`flex-1 truncate ${selected ? '' : 'text-fg-subtle'}`}>
          {selected
            ? triggerLabel.format(selected)
            : (placeholder ?? t('empty'))}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel ?? t('dialogLabel')}
          className={`absolute z-50 mt-2 w-[17.5rem] rounded-xl border border-border bg-bg-elevated p-3 shadow-soft-lg ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label={t('previousMonth')}
              onClick={() => setCursor(addMonths(cursor, -1))}
              className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Announced on change so a screen reader following the arrows
                hears the new month without leaving the grid. */}
            <span
              id={`${baseId}-month`}
              aria-live="polite"
              className="text-sm font-semibold capitalize text-fg"
            >
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label={t('nextMonth')}
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <table
            ref={gridRef}
            role="grid"
            aria-labelledby={`${baseId}-month`}
            onKeyDown={onGridKeyDown}
            className="w-full border-separate border-spacing-y-0.5"
          >
            <thead>
              <tr>
                {weekdays.map((day) => (
                  <th
                    key={day.long}
                    scope="col"
                    abbr={day.long}
                    className="pb-1 text-center text-[10px] font-medium uppercase text-fg-subtle"
                  >
                    {day.narrow}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={toISODate(week[0])}>
                  {week.map((day) => {
                    const isSelected = Boolean(
                      selected && sameDay(day, selected),
                    )
                    const isCursor = sameDay(day, cursor)
                    const isToday = sameDay(day, today)
                    const outside = day.getMonth() !== cursor.getMonth()
                    const unavailable = isOutOfRange(day)
                    return (
                      <td
                        key={toISODate(day)}
                        role="gridcell"
                        aria-selected={isSelected}
                        className="p-0 text-center"
                      >
                        <button
                          type="button"
                          // Roving tabindex: Tab enters the grid at the cursor
                          // and leaves it in one press, instead of walking 42
                          // day buttons.
                          tabIndex={isCursor ? 0 : -1}
                          data-cursor={isCursor}
                          disabled={unavailable}
                          aria-label={dayLabel.format(day)}
                          aria-current={isToday ? 'date' : undefined}
                          onClick={() => commit(day)}
                          className={`h-9 w-9 rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                            isSelected
                              ? 'bg-brand-500 font-semibold text-white hover:bg-brand-600'
                              : `hover:bg-surface-2 ${outside ? 'text-fg-subtle' : 'text-fg'}`
                          } ${
                            isToday && !isSelected
                              ? 'font-semibold text-brand-600 ring-1 ring-inset ring-brand-500/40 dark:text-brand-300'
                              : ''
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <button
              type="button"
              disabled={isOutOfRange(today)}
              onClick={() => commit(today)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent dark:text-brand-300"
            >
              {t('today')}
            </button>
            {clearable && value ? (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  closePicker()
                }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {t('clear')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function ChevronLeft({ className = '' }: { className?: string }) {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRight({ className = '' }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
