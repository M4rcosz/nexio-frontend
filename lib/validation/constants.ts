// Single source of truth for the field constraints shared between the browser
// forms and the BFF route handlers. Keeping the numbers/patterns here means the
// client-side instant feedback and the server-side zod schemas can never drift.
import type { ProductImageContentType } from '@/lib/api/types'

/**
 * Allowed username shape: lowercase letters/digits, with `.`, `_` or `-` only in
 * the interior (never at the first or last position). Uppercase is intentionally
 * excluded so it FAILS validation instead of being silently lowercased.
 */
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 50
/** Login accepts anything the account may have (lenient) up to this bound. */
export const USERNAME_LOGIN_MAX_LENGTH = 256

/**
 * Reserved handles that must never be claimed at registration/admin-create.
 * Exact (lowercase) match — the username pattern already forces lowercase.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'anonymous',
  'api',
  'auth',
  'login',
  'logout',
  'manager',
  'me',
  'moderator',
  'null',
  'register',
  'root',
  'security',
  'staff',
  'support',
  'system',
  'undefined',
  'user',
  'users',
])

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128
/** Login only checks length (no complexity) so legacy passwords still work. */
export const PASSWORD_LOGIN_MIN_LENGTH = 8

/** Postgres int4 upper bound — the backend stores quantities as int. */
export const MAX_INVENTORY_QUANTITY = 2147483647
export const REASON_MAX_LENGTH = 150

// --- AI assistant (memberships + chat) ---

/** Postgres int4 bounds — the backend stores the token balance as a signed int. */
export const AI_TOKEN_MAX = 2147483647
/** Enroll grant floor / balance floor. */
export const AI_TOKEN_MIN = 0
/** A single chat message / history turn is capped at this many characters. */
export const CHAT_MESSAGE_MAX_LENGTH = 4000
/** The server accepts at most this many seed turns in `history`. */
export const CHAT_HISTORY_MAX_TURNS = 50
/**
 * How many of a thread's stored turns the server replays to the model. A
 * deliberate cost bound: past this the assistant no longer recalls the earliest
 * turns, even though the transcript route still returns all of them.
 */
export const CHAT_REPLAYED_TURNS = 40

/**
 * A conversation title is capped at this length in CODE POINTS (`[...str].length`),
 * not UTF-16 units — so an 80-emoji title is valid where `.length` would read 160.
 */
export const CONVERSATION_TITLE_MAX_LENGTH = 80

// --- Product images ---

/**
 * Content types the storage bucket accepts. The bucket and the API both
 * enforce this server-side; checking locally turns a round trip into an
 * instant message. `image/svg+xml` is absent on purpose — an SVG is a script
 * host, so it must be rejected even when the file picker offers it.
 */
export const PRODUCT_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const satisfies readonly ProductImageContentType[]

/** `accept` hint for the file input. A hint, not a guarantee — users can still
 * pick anything through "all files", so the checks above stay. */
export const PRODUCT_IMAGE_ACCEPT = PRODUCT_IMAGE_CONTENT_TYPES.join(',')

/** Mirrors the backend's SUPABASE_IMAGE_MAX_BYTES (5 MB). */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** `path` is capped at 300 chars by the confirm endpoint. */
export const PRODUCT_IMAGE_PATH_MAX_LENGTH = 300

export const EMAIL_MAX_LENGTH = 254
export const NAME_MAX_LENGTH = 120
export const PHONE_MAX_LENGTH = 20

// --- Workflow engine (nexio-workflow) ---
//
// Mirrors the limits nexio-workflow enforces server-side — see
// docs/FRONTEND-INTEGRATION.md §2.6, §2.7, §6, §7 and §11 in that repo. They
// live here rather than inside the transport layer because both sides need
// them: the browser forms for instant feedback and the BFF handlers for the
// authoritative check.

/** `name` ≤ 200 (§6 "Text"). */
export const WORKFLOW_NAME_MAX_LENGTH = 200
/** `description` ≤ 2000 (§6 "Text"). */
export const WORKFLOW_DESCRIPTION_MAX_LENGTH = 2000

/** Node ids must match this exactly (§6 "Graph"). */
export const WORKFLOW_NODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
/** A definition may hold at most this many nodes (§6 "Graph"). */
export const WORKFLOW_MAX_NODES = 50

/** `url` ≤ 2048 on an HTTP_REQUEST node (§6 per-node table). */
export const WORKFLOW_URL_MAX_LENGTH = 2048
/** `expression` ≤ 512 on a CONDITION node (§6 per-node table). */
export const WORKFLOW_EXPRESSION_MAX_LENGTH = 512

// Free-form maps (`headers`, `body`, `config`, `payload`) — §6 "Free-form maps".
// Note the entry budget is counted ACROSS ALL LEVELS, not per object.
export const WORKFLOW_MAP_MAX_KEY_LENGTH = 128
export const WORKFLOW_MAP_MAX_STRING_LENGTH = 4096
export const WORKFLOW_MAP_MAX_ENTRIES = 200
export const WORKFLOW_MAP_MAX_DEPTH = 10

/** ≤ 20 `{{…}}` placeholders per templated field (§7). */
export const WORKFLOW_MAX_PLACEHOLDERS_PER_FIELD = 20

// Paging (§2.6). The service returns a bare array with no total, so these are
// also what the offset pager reasons about ("next" iff `items.length === limit`).
export const WORKFLOW_LIMIT_MIN = 1
export const WORKFLOW_LIMIT_MAX = 100
export const WORKFLOW_DEFAULT_LIMIT = 20
export const WORKFLOW_OFFSET_MAX = 10000

/** Request bodies are capped at 256 KB upstream — 413 past it (§2.7). */
export const WORKFLOW_REQUEST_MAX_BYTES = 256 * 1024

/**
 * Budget for `triggerWorkflow` specifically. The engine's own cap is 30s checked
 * *before each node*, and a node already running is not interrupted, so the
 * realistic worst case is "a bit over 40s" (§2.3). 60s leaves headroom without
 * hanging a request forever.
 */
export const WORKFLOW_TRIGGER_TIMEOUT_MS = 60_000

/** Spring cron: six fields, SECONDS FIRST — not the five-field Unix form (§11). */
export const WORKFLOW_CRON_FIELD_COUNT = 6
/** A schedule may not fire more often than this (§11). */
export const WORKFLOW_CRON_MIN_INTERVAL_SECONDS = 30

/** An execution can hold up to this many steps (§2.5) — why lists omit `steps`. */
export const WORKFLOW_MAX_STEPS = 200
