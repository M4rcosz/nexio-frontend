# CLAUDE.md

Conventions for working in this repo. Setup, environment variables and the
architectural rationale live in [README.md](README.md) — this file covers the
rules that are easy to break without noticing.

## Layout width — the shell tiers

**There is no global width cap.** Route width is decided in one place:
`lib/layout/shell.ts`. A single cap can't serve both a 65ch login form and a
12-column order table, so width is capped per *content type*:

| Tier      | Width       | Routes                                          |
| --------- | ----------- | ----------------------------------------------- |
| `prose`   | 768px       | `/login`, `/register`, `/profile`               |
| `content` | 1152px      | **default** — `/cart`, `/checkout`, `/orders`, `/pos` |
| `wide`    | 1600px      | `/`, `/admin/*`, `/ai`, `/units/<id>`           |
| `full`    | uncapped    | `/totem/*`                                      |

**When you add a route, decide its tier.** Unlisted paths fall through to
`content`, which is safe but may not be what you want. Register it in the
prefix arrays in `lib/layout/shell.ts` and add a case to `shell.test.ts`.

`shellTier()` is **presentation only** — it must never gate access. Role checks
stay in `getAdminContext` / `POS_ROLES` / `KIOSK_ROLES`.

The tier is applied by `components/layout/Shell.tsx`, a client component. It
must stay a client component: the `[locale]` layout is *not* re-sent on soft
navigation, so a server-only tier would stick at whatever the first hard load
resolved (navigating `/` → `/login` would render the login form at 1600px).
`Shell` recomputes from `usePathname()`.

`.shell*` classes live in `app/globals.css` under `@layer components`. The
class strings in `TIER_CLASS` are what Tailwind's purge sees — `lib/**` is in
the `content` globs, so **moving that map out of `lib/` would silently drop
the CSS**.

### Rules that follow from the tiers

- **Line-length-bound content never widens.** Prose, form fields and message
  bubbles keep their own `max-w-*` regardless of tier. Admin form pages use
  `components/admin/AdminFormCard.tsx` (`max-w-3xl`) — cap at the page
  wrapper, never inside a reusable `*Form`, since several are also rendered on
  the narrower `/profile`.
- **Card grids use intrinsic columns, not breakpoints:**
  `sm:grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]`. The `sm:` prefix is
  load-bearing — unprefixed it yields 2 columns at ~614px where there should
  be 1.
- **`auto-fill` vs `auto-fit`**: `auto-fill` for variable-length collections
  (catalogs — 2 products shouldn't stretch across 1536px); `auto-fit` for
  fixed-count rows (the 3 admin stat cards), where empty tracks would
  otherwise hold dead space.
- **`max-width` on a `<td>` does nothing** under `table-layout: auto`, and a
  sibling `truncate` won't fire either. Put the cap on an inner element.
- **Every `loading.tsx` must mirror its page's grid template *and* card
  shape.** A matching grid with the wrong card body still causes layout
  shift.

## Data freshness

Mutating API route handlers **must** call `revalidateTag(...)` for the tags
their mutation invalidates, or RSC lists render stale after the write. ~20
handlers under `app/api/` follow this — copy the nearest one.

## Domain rules

Order channels (`APP`/`WEB`/`TOTEM`/`COUNTER`/`PICKUP`) and the status state
machine are centralized in `lib/orders/channelPolicy.ts` and
`lib/orders/statusMachine.ts`. Derive form and board behaviour from those
tables; don't re-derive the rules per screen.

## Styling

Semantic tokens only — `bg`, `surface`, `fg`, `border`, `brand-*`, `accent-*`
(see `tailwind.config.ts`). They're CSS variables so a tenant can re-skin the
whole UI, so **hardcoded colors break multi-tenancy**. Reach for the existing
`.card` / `.btn-*` / `.input` / `.chip-*` component classes before writing new
utility soup.

## Testing

Vitest + Testing Library, tests colocated as `*.test.tsx` next to the source.
`npm test` runs the suite; `npm run typecheck` and `npm run lint` must both be
clean. Husky + lint-staged run on commit — never bypass with `--no-verify`.

## Commits

Conventional Commits. **Do not add a `Co-Authored-By` trailer.**
