# Nexio — Web frontend (customer)

[![version](https://img.shields.io/github/package-json/v/M4rcosz/nexio-frontend?label=version&color=blue)](https://github.com/M4rcosz/nexio-frontend/blob/main/package.json)

Next.js (App Router) frontend for the **WEB** sales channel of Nexio, a
unified commerce platform. Built from the contract in
`nexio-frontend-briefing.md` (the briefing document that lives at the root
of the backend repository).

The product targets Brazilian end-customers but the UI ships in two
languages so it can be demoed to a wider audience — see [Internationalization](#internationalization).

## Running locally

**Node.js 20+** is required. With [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm use   # reads .nvmrc
```

Then install and start the dev server:

```bash
npm install
npm run dev
```

The app starts on the default Next.js port. To avoid colliding with the
backend (which runs on `:3000`), use:

```bash
PORT=3001 npm run dev
```

## Backend status

A growing set of endpoints is wired to the real backend; the rest is mocked
locally following the schema described in the briefing — see
[briefing §6](nexio-frontend-briefing.md) for the full catalogue. Every
resource marked "real backend + mock fallback" honours `NEXT_PUBLIC_USE_MOCKS`.

| Resource              | Source                                          |
| --------------------- | ----------------------------------------------- |
| Login                 | Real backend (`POST /api/auth/login`)           |
| Menu (products)       | Real backend (`GET /api/products/...`)          |
| Signup                | Stub (`/api/auth/register` Next route handler)  |
| Business units (public list + admin CRUD) | Real backend + mock fallback (`GET/POST /api/business-units`, `GET/PATCH /api/business-units/:id`, `POST /api/business-units/:id/active`) |
| Categories (public list + admin CRUD) | Real backend + mock fallback (`GET/POST /api/categories`, `GET/PATCH /api/categories/:id`) |
| User profile          | Real backend + mock fallback (`GET /api/users/me`, `PATCH /api/users/me`, `PATCH /api/users/me/password`) |
| Orders / Payment      | Real backend + mock fallback (`GET /api/orders/me`, `POST/GET /api/orders`, `/api/payments/...`) |
| Products (admin CRUD) | Real backend + mock fallback (`POST /api/products`, `PATCH /api/products/:id`) |
| Menu (business unit — admin) | Real backend + mock fallback (`POST /api/business-units/:id/menu`, `PATCH /api/business-units/:id/menu/:itemId`, `POST /api/business-units/:id/menu/:itemId/available`) |
| Loyalty               | Mock                                            |
| Inventory (admin)     | Real backend + mock fallback (`GET /api/inventory/:businessUnitId`, `POST /api/inventory/:businessUnitId/items`, `POST /api/inventory/:businessUnitId/adjust`)  |
| Promotions (admin)    | Real backend + mock fallback (`/api/promotions/...`)         |

The `NEXT_PUBLIC_USE_MOCKS=true` flag in `.env.local` forces the *menu* and
*login* resources to use mocks too — handy when the backend is not running.
Switch it to `false` to point at the local NestJS instance.

## Environment variables

See `.env.example`. The relevant ones:

- `NEXT_PUBLIC_API_BASE_URL` — base URL of the backend (default `http://localhost:3000/api`).
- `NEXT_PUBLIC_USE_MOCKS` — `'true'` makes the resources that have a real
  backend endpoint fall back to mocks; `'false'` calls the backend.
- `BACKEND_INTERNAL_URL` — used by `serverFetch` (server-only).
- `SESSION_COOKIE_NAME` — name of the httpOnly cookie that holds the JWT.
- `SESSION_COOKIE_SECURE` — `'true'` in production.

## Key decisions

- **i18n** through `next-intl` with path prefix. EN is the default (root
  `/`); PT-BR is served at `/pt-BR/...`. Strings live in
  `messages/{en,pt-BR}.json`. The `LanguageSwitcher` in the header swaps
  locale while preserving the current pathname.
- **JWT in an httpOnly cookie** via Route Handlers (`app/api/auth/login`).
  The browser never holds the token directly.
- **Money** through `big.js` (`lib/money.ts`). Rendering uses
  `Intl.NumberFormat(locale, { style: 'currency', currency: 'BRL' })`.
  The Brazilian Real stays the only currency in both languages (we sell in
  Brazil), only the number formatting differs (`R$58.90` vs `R$ 58,90`).
- **Cart** persisted in `localStorage` through Zustand
  (`lib/cart/store.ts`). Switching units empties the cart.
- **Multi-tenancy**: the customer picks `businessUnitId` per order. It goes
  in the body of `POST /api/orders`. The last selected unit is kept in
  cookie/localStorage.
- **Polling** on order tracking (5s) and on payment status (4s) — the
  backend has no WebSocket yet.
- **No OpenAPI**: types are typed manually in `lib/api/types.ts`. Route
  handler input is validated with Zod.

## Internationalization

Adding a new language:

1. Append the BCP-47 code in `i18n/routing.ts` (`locales` array).
2. Create `messages/<locale>.json` mirroring the key structure of
   `messages/en.json`.
3. Add a label under the `languageSwitcher` namespace in every message file.

URL paths are identical across languages (e.g. `/cart` and `/pt-BR/cart`).
If you want fully localized paths (e.g. `/pt-BR/carrinho`), use the
`pathnames` feature of `next-intl/routing` — it was intentionally left off
to keep the config small.

> **Note on mock data**: the proper-noun parts of the menu (dish and
> business unit names) are kept in Portuguese on purpose. They map to the
> real Brazilian content a backend would return; restaurant menus do not
> usually translate dish names like "Carne de sol" or "Baião de dois".

## Project layout

```
app/
├── [locale]/                    # Everything user-facing (EN / PT-BR)
│   ├── page.tsx                 # Home (pick a unit)
│   ├── login/                   # Login (real)
│   ├── register/                # Signup (stub)
│   ├── units/[id]/              # Menu + product detail
│   ├── cart/                    # Cart (client state)
│   ├── checkout/                # Checkout
│   ├── payment/[orderId]/       # Payment
│   ├── orders/                  # History + tracking (cursor pagination, channel/status filters)
│   ├── loyalty/                 # Points and LGPD consent
│   ├── profile/                 # Own account (GET/PATCH /users/me + change password)
│   ├── admin/                   # Admin area: overview, users, products, categories, menu, business-units, inventory, promotions
│   ├── error.tsx                # Boundary
│   ├── loading.tsx
│   ├── not-found.tsx
│   └── layout.tsx               # html/body + NextIntlClientProvider
└── api/                         # Route handlers (locale-agnostic)
components/                      # Shared UI components
i18n/
├── routing.ts                   # Locales, default locale
├── navigation.ts                # Locale-aware Link, redirect, useRouter
└── request.ts                   # Server-side message loader
messages/
├── en.json
└── pt-BR.json
lib/
├── api/                         # Client + types + resources + mocks
├── auth/                        # Cookie helpers + session
├── cart/                        # Zustand store
├── format.ts                    # ORDER_STATUS_TIMELINE + formatDateTime(locale)
└── money.ts                     # big.js helpers + formatMoney(value, locale)
middleware.ts                    # i18n + protected-route guard
```

## Auth flow (60s expiration warning)

The backend JWT expires after **60 seconds** (PoC; this will change).
On a 401 response the user is sent back to `/login` with `?redirect=...`.
There is no refresh: `/api/auth/refresh` answers 501 on purpose. Do not
implement client-side refresh until the backend exposes the endpoint.

## Next steps when the backend ships more endpoints

1. In `lib/api/<resource>.ts` swap `return mock(...)` for `serverFetch(...)`.
   The public function signature does not change.
2. Optionally keep the `[stub]` fallback so you can run offline.
3. Drop the `StubBadge` from the corresponding pages.

## Backlog

### Nearest-unit selection via GPS

The home unit picker currently defaults to the first unit returned by
`GET /business-units`. Planned enhancement: let the customer auto-select the
**nearest** unit using device location (GPS).

How it breaks down:

1. **Read the customer's position — frontend only.** Use the browser
   `navigator.geolocation.getCurrentPosition()` (combines GPS / Wi-Fi / IP under
   the hood). Requires HTTPS and explicit user permission. Accurate on mobile
   (real GPS), coarser on desktop.
2. **Unit coordinates — requires the backend.** Today `PublicBusinessUnit` has
   no coordinates. The backend must add `latitude` / `longitude` to business
   units (migration) and expose them on `GET /business-units`. **This is the
   blocker** — without unit coordinates there is nothing to measure distance to.
3. **Pick the nearest — haversine.** With the customer position (1) and unit
   coordinates (2), compute great-circle distance and take the minimum. Options:
   - Frontend haversine over all units (fine when there are few units), or
   - a backend `GET /business-units/nearest?lat=..&lng=..` endpoint that sorts by
     distance in the DB (PostGIS `ST_Distance` / SQL) — better at scale.
4. **Fallback — always.** If permission is denied, GPS fails, or no coordinates
   exist, keep the current default (first unit). Never block the page on GPS.

Frontend can ship a "📍 Use my location" button + a haversine helper ahead of
time; it stays on the fallback until the backend serves `latitude`/`longitude`.
(Note: this is GPS-based, not an LLM feature.)

## Useful scripts

| Command                | Description                     |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Development server with HMR     |
| `npm run build`        | Production build                |
| `npm run start`        | Run the production build        |
| `npm run typecheck`    | Run `tsc --noEmit`              |
| `npm run lint`         | ESLint (flat config)            |
| `npm test`             | Run the Vitest suite once       |
| `npm run test:watch`   | Run Vitest in watch mode        |
| `npm run coverage`     | Vitest suite + coverage report  |
| `npm run format`       | Format the codebase (Prettier)  |
| `npm run format:check` | Check formatting without writing |

## Testing

Tests live next to the code they cover (e.g. `lib/api/errors.test.ts`,
`app/api/products/route.test.ts`) and run on [Vitest](https://vitest.dev/).
The suite focuses on the security-critical surface — route-handler auth
guards, unit-scoping, zod validation — and pure helpers. Run `npm test`
before pushing; `npm run coverage` writes an HTML report to `coverage/`.

## Continuous integration

Every pull request and every push to `main` runs
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) on Node 20 and 22:
type-check → lint → tests (with coverage) → production build.

## Pre-commit hooks

[Husky](https://typicode.github.io/husky/) + `lint-staged` lint and format
staged files, then run the type-checker, on every commit. It is wired up
automatically by `npm install` (the `prepare` script). If a hook fails, fix
the reported issue and commit again.
