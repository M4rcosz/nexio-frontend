# Raízes do Nordeste — Web frontend (customer)

Next.js (App Router) frontend for the **WEB** sales channel of Raízes do
Nordeste, a Brazilian Northeast restaurant chain. Built from the contract in
`raizes-frontend-briefing.md` (the briefing document that lives at the root
of the backend repository).

The product targets Brazilian end-customers but the UI ships in two
languages so it can be demoed to a wider audience — see [Internationalization](#internationalization).

## Running locally

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

Only **4 real endpoints** are available (menu + login). Everything else is
mocked locally following the schema described in the briefing — see
[briefing §6](raizes-frontend-briefing.md) for the full catalogue.

| Resource              | Source                                          |
| --------------------- | ----------------------------------------------- |
| Login                 | Real backend (`POST /api/auth/login`)           |
| Menu (products)       | Real backend (`GET /api/products/...`)          |
| Signup                | Stub (`/api/auth/register` Next route handler)  |
| Business units, categories | Mock (`lib/api/mocks/*`)                   |
| Business units (internal/admin list) | Real backend + mock fallback (`GET /api/business-units/internal`) |
| Orders / Payment      | Mock                                            |
| Loyalty               | Mock                                            |
| Inventory (admin)     | Real backend + mock fallback (`GET/POST /api/inventory/...`)  |
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
│   ├── orders/                  # History + tracking
│   ├── loyalty/                 # Points and LGPD consent
│   ├── admin/                   # Admin area: overview, users, inventory, promotions
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

## Useful scripts

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `npm run dev`      | Development server with HMR       |
| `npm run build`    | Production build                  |
| `npm run start`    | Run the production build          |
| `npm run typecheck`| Run `tsc --noEmit`                |
| `npm run lint`     | Next.js lint                      |
