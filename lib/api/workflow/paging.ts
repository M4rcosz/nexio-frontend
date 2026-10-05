// §2.6: `limit` is 1–100 (default 20) and `offset` is 0–10000. A value outside
// those comes back as `BAD_REQUEST`, so clamp instead of letting the server
// refuse — a pager link with a stale offset should land on the last page, not on
// an error card.
//
// Shared rather than inlined (unlike the one-off clamp in
// `app/api/ai/conversations/route.ts`) because both sides need the same numbers:
// the route handler when it builds the GraphQL variables, and the offset pager
// when it decides where "prev"/"next" point.
import {
  WORKFLOW_DEFAULT_LIMIT,
  WORKFLOW_LIMIT_MAX,
  WORKFLOW_LIMIT_MIN,
  WORKFLOW_OFFSET_MAX,
} from '@/lib/validation/constants'

export type WorkflowPaging = {
  limit: number
  offset: number
}

/**
 * Clamps a `limit`/`offset` pair into the range the service accepts. Anything
 * unusable — `undefined`, `NaN`, `Infinity`, a fractional or negative number —
 * falls back to the default rather than being passed through, so a hand-edited
 * `?offset=` in the URL can never produce a `BAD_REQUEST`.
 */
export function clampWorkflowPaging(
  input: { limit?: number | null; offset?: number | null } = {},
): WorkflowPaging {
  return {
    limit: clamp(
      input.limit,
      WORKFLOW_LIMIT_MIN,
      WORKFLOW_LIMIT_MAX,
      WORKFLOW_DEFAULT_LIMIT,
    ),
    offset: clamp(input.offset, 0, WORKFLOW_OFFSET_MAX, 0),
  }
}

function clamp(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/**
 * Parses an offset straight off a search param. `?offset=` arrives as a string
 * or not at all, and garbage in it must not reach the service.
 */
export function parseWorkflowOffset(
  raw: string | string[] | undefined,
): number {
  const first = Array.isArray(raw) ? raw[0] : raw
  if (first === undefined || first.trim() === '') return 0
  return clampWorkflowPaging({ offset: Number(first) }).offset
}

/**
 * Whether a "next page" link should be offered. `workflows` and `executions`
 * return a **bare array** with no total and no envelope (unlike the cursor
 * `Paginated<T>` used everywhere else in this repo), so the only signal is a
 * full page — one extra click that lands on an empty page is the accepted cost.
 */
export function hasNextWorkflowPage(
  itemCount: number,
  paging: WorkflowPaging,
): boolean {
  return (
    itemCount >= paging.limit &&
    paging.offset + paging.limit <= WORKFLOW_OFFSET_MAX
  )
}

/** The offset for the previous page, floored at 0. */
export function previousWorkflowOffset(paging: WorkflowPaging): number {
  return Math.max(0, paging.offset - paging.limit)
}
