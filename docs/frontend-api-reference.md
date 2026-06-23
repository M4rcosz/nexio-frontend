# Raízes do Nordeste — Frontend API Reference

A hand-written, end-to-end reference for the **Raízes do Nordeste** backend API, written for
the frontend team. It captures not just the shapes of requests and responses but the **rules and
intent** behind them — the order state machine, server-authoritative pricing, channel-driven
customer resolution, optimistic-lock conflicts, and the webhook-driven payment flow.

This document **complements** the live Swagger UI; it does not replace it:

- **Swagger** (`GET /api/docs`, non-production only) = the live, generated schema. Source of truth
  for exact field presence at any moment.
- **This document** = the rules, the intent, and ready-to-copy TypeScript contracts that Swagger
  cannot express.

> Verified against the backend on branch `feat/payments`. If the backend changes, re-check the
> referenced source files (paths below are relative to the backend repo).

---

## 1. Conventions

These apply to **every** endpoint. Read this section first.

### Base URL

- All routes live under the global prefix `/api` (`src/main.ts` — `app.setGlobalPrefix('api')`).
- **Dev base URL:** `http://localhost:3000/api` (already the frontend default; see
  `NEXT_PUBLIC_API_BASE_URL`).
- **No API versioning** is wired yet. `/api/v1` is on the roadmap, not present today.

### Authentication

- A **global `AuthGuard`** protects every route (`src/app.module.ts`). Unless a route is marked
  `@Public()`, it requires:

  ```http
  Authorization: Bearer <JWT>
  ```

- Get the token from `POST /api/auth/login`.
- The JWT payload is `{ sub, username, role, iat, exp }` (`src/shared/auth/jwt-payload.type.ts`).
  `sub` is the user id; `role` is one of the `UserRole` values.
- **Authorization rules** (`AuthGuard.canActivate`):
  - `@Public()` → no token needed.
  - Token present + no `@Roles(...)` on the route → **any authenticated user** passes.
  - Token present + `@Roles([...])` → the user's `role` must be in the list, otherwise **403**.
  - Missing/invalid/expired token on a protected route → **401**.

### Validation (the 400 vs 422 distinction)

A global `ValidationPipe` runs with `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`, `enableImplicitConversion: false` (`src/app.module.ts`). Consequences for you:

- **Send exactly the documented fields.** Any unknown/extra body field → **400**.
- **No implicit type coercion.** JSON types must be correct. Query-string numbers are converted
  only where a DTO opts in via `@Type(() => Number)` — today that is the `limit` query param.
- A DTO validation failure (wrong type, missing required field, bad enum, malformed UUID) →
  **`400 Bad Request`** (NestJS default; the pipe does not set `errorHttpStatusCode`).

> **Key rule:** **`400` = malformed request** (failed DTO validation). **`422` = well-formed
> request that violates a business rule** (e.g. illegal state transition, price mismatch).
> They are different and you should branch on them differently.

### Money & decimals

- **Order and payment amounts are decimal strings** (`"12.50"`) on **both** request and response —
  never JS numbers. Fields: `unitPrice`, `subtotal`, `totalAmount` (orders), `amount` (payments).
- **Exception:** product **`price` is returned as a number** (`18.5`) but **sent as a decimal
  string** (`"18.50"`) when creating a product.
- Use a decimal library (`big.js` / `decimal.js`) for any arithmetic or comparison. **Never** use
  `===`, `+`, or `parseFloat` on money.

### Dates

ISO-8601 strings, e.g. `2026-05-18T10:30:00.000Z`.

### Error envelope

Every error (validation, auth, and domain/business) is returned in one shape
(`src/shared/errors/error-envelope.type.ts`, `src/shared/filter/global-error.filter.ts`):

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Unit price 10.00 does not match the authoritative price 12.50 …",
  "path": "/api/orders",
  "timestamp": "2026-05-31T10:30:00.000Z"
}
```

- `statusCode` — HTTP status (also in the response status line).
- `error` — the standard reason phrase for that status.
- `message` — human-readable; for `400` validation failures, multiple messages are joined with
  `", "`.
- `path` — the request path.
- `timestamp` — when the error was produced.

### Pagination (cursor-based)

Source: `src/shared/pagination/`.

- **Request query:** `limit?` (1–100, default 20, **clamped server-side** — `?limit=999999`
  becomes 100) and `cursor?` (the id of the last item you saw).
- **Response envelope:**

  ```json
  {
    "data": [ /* items */ ],
    "meta": { "limit": 20, "nextCursor": "uuid-or-null", "hasMore": true }
  }
  ```

- **To page:** while `meta.hasMore` is `true`, pass `meta.nextCursor` as the next request's
  `cursor`. When `hasMore` is `false`, `nextCursor` is `null` and you've reached the end.

---

## 2. Auth flow

1. `POST /api/auth/login` with `{ username, password }`. On success you get
   `{ access_token: "<JWT>" }`.
2. Send `Authorization: Bearer <access_token>` on every subsequent request.
3. The token encodes the user's `role`, which determines what they can call.

### Role table (`UserRole`)

| Role        | Typical use                          | Can list/manage orders (STAFF) | Can attend COUNTER/PICKUP |
| ----------- | ------------------------------------ | :----------------------------: | :-----------------------: |
| `ADMIN`     | Full administration                  |               ✅               |            ✅             |
| `MANAGER`   | Unit management                      |               ✅               |            ✅             |
| `ATTENDANT` | Front-of-house / counter staff       |               ✅               |            ✅             |
| `KITCHEN`   | Kitchen / preparation                |               ✅               |            ❌             |
| `CUSTOMER`  | End customer (app/web)               |               ❌               |            ❌             |

- **STAFF roles** = `ADMIN, MANAGER, ATTENDANT, KITCHEN` — may list all orders and change order
  status.
- **Attending roles** = `ADMIN, MANAGER, ATTENDANT` — may place orders on attendant-only channels
  (`COUNTER`, `PICKUP`). `KITCHEN` is staff but does **not** serve customers, so it is excluded.

---

## 3. Endpoint reference

Base path `/api` is implied on every path below.

### 3.1 Identity

#### `POST /auth/login`

- **Auth:** `@Public()` — no token.
- **Status:** `200 OK`.
- **Body:** `{ username: string, password: string }` (`password` min length 8).
- **Response:** `{ "access_token": "<JWT>" }`.
- **Errors:** `400` malformed body; `401` invalid credentials.

---

### 3.2 Business units (products)

#### `GET /products`

- **Auth:** `@Public()`.
- **Query:** `limit?`, `cursor?`, `categoryId?` (uuid), `search?`.
- **Response:** `Paginated<ProductResponse>` (`200`).

#### `GET /products/by-business-unit/:businessUnitId`

- **Auth:** `@Public()`.
- **Params:** `businessUnitId` (uuid).
- **Query:** `limit?`, `cursor?`, `categoryId?` (uuid), `search?`.
- **Response:** `Paginated<ProductResponse>` (`200`).

#### `GET /products/:productId`

- **Auth:** `@Public()`.
- **Params:** `productId` (uuid).
- **Response:** `ProductResponse` (`200`).
- **Errors:** `404` product not found.

#### `POST /products`

- **Auth:** `@Roles(['ADMIN', 'MANAGER'])`.
- **Status:** `201 Created`.
- **Body:** `ProductCreateRequest`:
  - `name` — string, ≤ 100.
  - `description?` — string, ≤ 255.
  - `price` — **decimal string**, positive (rejects `"0"`), up to 8 integer + 2 fractional digits
    (DB `Decimal(10,2)`).
  - `categoryId` — uuid.
  - `imageUrl` — URL, ≤ 2000.
- **Response:** `ProductResponse` (note `price` comes back as a **number**).
- **Errors:** `400` malformed body; `401` no token; `403` wrong role; `409` a product with that
  name already exists; `404` the referenced category does not exist.

---

### 3.3 Orders

#### `POST /orders`

- **Auth:** any authenticated user (no `@Roles`).
- **Status:** `201 Created`.
- **Body:** `OrderCreateRequest` (see [§4.3](#43-channel--customer-resolution) for channel rules).
- **Response:** `OrderResponse` — newly created order, `orderStatus: "PENDING"`.
- **Errors:**
  - `400` malformed body (e.g. empty `orderItems`, bad UUID, non-decimal `unitPrice`).
  - `403` attendant required — a `COUNTER`/`PICKUP` order placed by a user without attend
    privilege.
  - `404` a product is not on this business unit's menu.
  - `422` price mismatch / product inactive / product unavailable.

**Example request**

```json
POST /api/orders
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "businessUnitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "orderChannel": "APP",
  "notes": "No onions, please",
  "orderItems": [
    { "productId": "550e8400-e29b-41d4-a716-446655440000", "quantity": 2, "unitPrice": "12.50" },
    { "productId": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "quantity": 1, "unitPrice": "8.00", "notes": "extra spicy" }
  ]
}
```

**Example response** (`201`)

```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000000",
  "businessUnitId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "customerId": "user-uuid-from-jwt",
  "attendantId": null,
  "pointsRedeemed": 0,
  "pointsEarned": 0,
  "totalAmount": "33.00",
  "notes": "No onions, please",
  "orderChannel": "APP",
  "orderStatus": "PENDING",
  "createdAt": "2026-05-31T10:30:00.000Z",
  "updatedAt": "2026-05-31T10:30:00.000Z",
  "updatedById": null,
  "orderItems": [
    { "id": "...", "productId": "550e8400-…", "quantity": 2, "unitPrice": "12.50", "subtotal": "25.00", "notes": null },
    { "id": "...", "productId": "7c9e6679-…", "quantity": 1, "unitPrice": "8.00", "subtotal": "8.00", "notes": "extra spicy" }
  ]
}
```

> `totalAmount` and each `subtotal` are computed **server-side** — do not send them. See
> [§4.1](#41-server-authoritative-pricing) / [§4.2](#42-total-is-server-computed).

#### `GET /orders`

- **Auth:** `@Roles(STAFF_ROLES)` — `ADMIN, MANAGER, ATTENDANT, KITCHEN`.
- **Query:** `limit?`, `cursor?`, `businessUnitId?` (uuid), `orderChannel?` (`OrderChannel`),
  `orderStatus?` (`OrderStatus`).
- **Response:** `Paginated<OrderResponse>` (`200`).
- **Errors:** `401` no token; `403` non-staff (e.g. `CUSTOMER`).

#### `GET /orders/:id`

- **Auth:** any authenticated user.
- **Params:** `id` (uuid).
- **Response:** `OrderResponse` (`200`).
- **Visibility:** customers see **only their own** orders; staff see any.
- **Errors:** `404` if the order is missing **or not visible to the caller** — the same `404` is
  returned for both so existence is never leaked.

#### `PATCH /orders/:id/status`

- **Auth:** `@Roles(STAFF_ROLES)`.
- **Status:** `200 OK`.
- **Params:** `id` (uuid).
- **Body:** `{ orderStatus: OrderStatus }` — the target status.
- **Response:** `OrderResponse` (updated).
- **Errors:**
  - `400` malformed body (e.g. not a valid `OrderStatus`).
  - `401`/`403` not authenticated / not staff.
  - `404` order not found.
  - `422` illegal transition (target not allowed from current status — see
    [§4.4](#44-order-state-machine)).
  - `409` concurrent change — the status changed between read and write (optimistic lock; see
    [§4.5](#45-optimistic-lock-conflict-on-status-update)).

---

### 3.4 Payments

#### `POST /payments`

- **Auth:** any authenticated user.
- **Status:** `201 Created`.
- **Body:** `{ orderId: string (uuid), method: PaymentMethod }`. **No amount** — the server charges
  the order's authoritative `totalAmount`.
- **Response:** `PaymentResponse` with `status: "PROCESSING"`.
- **Errors:**
  - `400` malformed body.
  - `404` order not found.
  - `422` order not payable — it is **not `PENDING`**, or it **already has a payment** (one payment
    per order).

**Example**

```json
POST /api/payments
Authorization: Bearer <JWT>
Content-Type: application/json

{ "orderId": "a1b2c3d4-0000-0000-0000-000000000000", "method": "PIX" }
```

```json
// 201 Created
{
  "id": "pay-uuid",
  "orderId": "a1b2c3d4-0000-0000-0000-000000000000",
  "amount": "33.00",
  "method": "PIX",
  "status": "PROCESSING",
  "extTransactionId": "mock_3f0c…",
  "createdAt": "2026-05-31T10:31:00.000Z",
  "updatedAt": "2026-05-31T10:31:00.000Z"
}
```

#### `POST /payments/webhook`

- **Auth:** `@Public()` **+ `PaymentWebhookGuard`** — requires header `x-webhook-secret`
  (validated against `PAYMENT_WEBHOOK_SECRET`).
- **Status:** `200 OK`.
- **Body:** `{ extTransactionId: string, status: "APPROVED" | "REFUSED" }`.
- **Response:** `PaymentResponse` (settled).
- **Errors:** `401` missing/invalid secret; `404` no payment matches the transaction.

> **The frontend never calls this.** It is the gateway → server callback that makes a payment
> final. Documented here only so you understand *how a payment becomes `APPROVED`/`REFUSED`* and why
> an approved payment also flips its order to `CONFIRMED`. See [§4.6](#46-payment-is-webhook-driven).

#### `GET /orders/:orderId/payment`

- **Auth:** any authenticated user.
- **Params:** `orderId` (uuid).
- **Response:** `PaymentResponse` (`200`).
- **Visibility:** customers see **only their own** order's payment; staff see any.
- **Errors:** `404` if the order has no payment, **or** it is not visible to the caller (same `404`
  for both — no enumeration leak).

### 3.5 Admin: inventory, promotions & internal unit listing

> Derived from the **frontend** clients/route handlers (`lib/api/inventory.ts`,
> `lib/api/promotions.ts`, `lib/api/business-units.ts`,
> `app/api/{inventory,promotions}/**`), not yet re-verified against the backend.
> Confirm exact shapes against Swagger before relying on them.

#### `GET /business-units/internal`

- **Consumed by:** `listBusinessUnitsInternal` (ADMIN unit selector — includes inactive units).
- **Query:** `limit?`, `cursor?`, `search?`, `city?`, `isActive?` (`"true"`/`"false"`).
- **Response:** `Paginated<BusinessUnit>`.

#### `GET /inventory/:businessUnitId`

- **Consumed by:** `listInventory`.
- **Response:** `InventoryItem[]` (not paginated).

#### `POST /inventory/:businessUnitId/adjust`

- **Consumed by:** `adjustInventory`.
- **Body:** `AdjustInventoryRequest` (`{ productId, type: 'IN' | 'OUT', quantity, reason }`).
- **Response:** `InventoryItem`.
- **Errors (mapped by the BFF):** `404` no stock balance for that product at the unit
  (`inventory_not_found`); `422` removal would drive the balance below zero
  (`inventory_below_zero`).

#### `GET /promotions/by-business-unit/:businessUnitId`

- **Consumed by:** `listPromotionsByBusinessUnit`.
- **Query:** `limit?`, `cursor?`.
- **Response:** `Paginated<Promotion>`.

#### `GET /promotions/:promotionId`

- **Consumed by:** `getPromotion`.
- **Response:** `Promotion` (`200`); `404` → client returns `null`.

#### `POST /promotions`

- **Consumed by:** `createPromotion`.
- **Body:** `CreatePromotionRequest`.
- **Response:** `Promotion` (`201`).
- **Note:** `discountType` is **`PERCENTAGE` | `FIXED_AMOUNT`** only — `FREE_ITEM` is
  rejected for promotions (the BFF returns `400 free_item_unsupported`). For a `MANAGER`
  the BFF overrides `businessUnitId` with the caller's scoped unit; for an `ADMIN` it is
  required in the body.

#### `PATCH /promotions/:promotionId`

- **Consumed by:** `updatePromotion`.
- **Body:** `UpdatePromotionRequest` (partial, without `businessUnitId`; empty body → `400`).
- **Response:** `Promotion` (`200`); `404` → client returns `null`.

---

## 4. Business rules & flows

These are the rules Swagger cannot express. Respect them in the UI.

### 4.1 Server-authoritative pricing

Each `orderItems[].unitPrice` you send **must equal** the business unit's authoritative price
(`BusinessUnitMenuItem.customPrice`). Any divergence → **`422` `PriceMismatchError`**
(`create-order.use-case.ts:152`).

- **Do:** send the price you fetched from the product / menu endpoint for that business unit.
- **Don't:** trust a cached or hard-coded price, or let the user edit it.
- Treat the server's computed `totalAmount` and each item `subtotal` as the source of truth for
  display and for the amount that will be charged.

### 4.2 Total is server-computed

The order `totalAmount` is computed server-side from the item subtotals. **Never** send a total —
there is no field for it, and it would be rejected as an unknown field (`400`).

### 4.3 Channel → customer resolution

The `orderChannel` decides who the order's customer is and who may place it
(`order-channel.ts`):

| Channel  | Customer source                          | Who may place it                  | Send `customerId`? |
| -------- | ---------------------------------------- | --------------------------------- | ------------------ |
| `APP`    | The authenticated user                   | Any authenticated user            | **No** (ignored)   |
| `WEB`    | The authenticated user                   | Any authenticated user            | **No** (ignored)   |
| `TOTEM`  | Anonymous (no customer attached)         | Any authenticated user            | **No**             |
| `COUNTER`| From the request body (optional)         | Staff with **attend** privilege   | Optional           |
| `PICKUP` | From the request body (optional)         | Staff with **attend** privilege   | Optional           |

- For `APP`/`WEB`, the customer is taken from the JWT — do **not** send `customerId`.
- For `COUNTER`/`PICKUP`, a user **without** attend privilege (`CUSTOMER`, or `KITCHEN`) → **`403`
  attendant required**. Only `ADMIN`, `MANAGER`, `ATTENDANT` may use these channels.

### 4.4 Order state machine

Allowed transitions (`order-status.ts`). `DELIVERED` and `CANCELLED` are terminal. An order can
never transition to itself.

```
PENDING ──▶ CONFIRMED ──▶ PREPARING ──▶ READY ──▶ DELIVERED   (terminal)
   │            │             │
   └────────────┴─────────────┴──────────▶ CANCELLED          (terminal)
```

| From        | Allowed targets             |
| ----------- | --------------------------- |
| `PENDING`   | `CONFIRMED`, `CANCELLED`    |
| `CONFIRMED` | `PREPARING`, `CANCELLED`    |
| `PREPARING` | `READY`, `CANCELLED`        |
| `READY`     | `DELIVERED`                 |
| `DELIVERED` | — (terminal)                |
| `CANCELLED` | — (terminal)                |

Any other target → **`422`**. **In the UI, only offer buttons for the legal next states** — use the
`ORDER_STATUS_TRANSITIONS` map ([§6](#6-typescript-types)) to derive them.

### 4.5 Optimistic-lock conflict on status update

`PATCH /orders/:id/status` uses an optimistic lock: the write only applies if the status you read
still holds. If another request transitioned the order in between, you get **`409`**. **On `409`,
refetch the order, re-derive the allowed actions from its new status, then retry** if the action
still makes sense.

### 4.6 Payment is webhook-driven

Payments settle **asynchronously** — there is **no synchronous payment result**. The flow:

1. `POST /payments` → returns `status: "PROCESSING"` immediately.
2. The gateway later calls `POST /payments/webhook` with the settled status. That webhook:
   - sets the payment to `APPROVED` or `REFUSED`, and
   - if `APPROVED`, advances the order to **`CONFIRMED`** (atomically).
3. **Poll `GET /orders/:orderId/payment`** until `status` is `APPROVED` or `REFUSED`. There is **no
   SSE/WebSocket** yet.

**Mock gateway** (`mock-payment-gateway.ts`): amount **exactly `13.13` → `REFUSED`**, everything
else → `APPROVED`, after ~200 ms simulated latency. Use `13.13` to exercise the refusal path.
Webhook redelivery is idempotent — an already-settled payment is returned unchanged.

### 4.7 One payment per order

Enforced by a DB unique constraint. A second `POST /payments` for the same order → **`422`**
(`order already has a payment`).

### 4.8 No idempotency keys

There are **no idempotency keys** yet. A duplicate `POST /orders` or `POST /payments` creates a
**duplicate**. The frontend must dedupe: disable the submit button on click and guard against
double-submits / retries.

### 4.9 Audit is internal

Order/payment actions are audited server-side. There is **no HTTP surface** for audit — nothing for
the frontend to call or display.

### Sequence: place order → pay → poll → confirmed

```
Client                         API                              Gateway
  │  POST /orders               │                                  │
  │ ───────────────────────────▶│  validate prices, build totals   │
  │ ◀─────────────────────────── │  201 OrderResponse (PENDING)     │
  │                             │                                    │
  │  POST /payments             │                                    │
  │ ───────────────────────────▶│  charge(totalAmount) ───────────▶ │
  │ ◀─────────────────────────── │  201 PaymentResponse (PROCESSING) │
  │                             │ ◀──── webhook {APPROVED} ───────── │  (x-webhook-secret)
  │                             │  settle payment + order → CONFIRMED
  │  GET /orders/:id/payment    │                                    │
  │ ───────────────────────────▶│  (poll on an interval)            │
  │ ◀─────────────────────────── │  200 PaymentResponse (APPROVED)   │
  │  GET /orders/:id            │                                    │
  │ ───────────────────────────▶│                                    │
  │ ◀─────────────────────────── │  200 OrderResponse (CONFIRMED)    │
```

---

## 5. Error reference

### Kind → HTTP status (`errors.type.ts`)

| Kind           | HTTP | Meaning                                                |
| -------------- | ---- | ------------------------------------------------------ |
| `not-found`    | 404  | Resource missing (or hidden from the caller)           |
| `invalid`      | 422  | Business rule / state-machine violation                |
| `conflict`     | 409  | Concurrent change / duplicate                          |
| `unauthorized` | 401  | Missing/invalid JWT or webhook secret                  |
| `forbidden`    | 403  | Authenticated but wrong role/privilege                 |
| `unavailable`  | 503  | A dependency is down                                   |

Plus **`400 Bad Request`** for any DTO validation failure (malformed request — see
[§1](#validation-the-400-vs-422-distinction)), and **`500`** for unexpected server errors.

### Per-endpoint error matrix

| Endpoint                          | 400 | 401 | 403 | 404 | 409 | 422 |
| --------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: |
| `POST /auth/login`                | ✅  | ✅  |     |     |     |     |
| `GET /products*`                  | ✅  |     |     | ✅¹ |     |     |
| `POST /products`                  | ✅  | ✅  | ✅  | ✅² | ✅³ |     |
| `POST /orders`                    | ✅  | ✅  | ✅⁴ | ✅⁵ |     | ✅⁶ |
| `GET /orders`                     | ✅  | ✅  | ✅  |     |     |     |
| `GET /orders/:id`                 |     | ✅  |     | ✅⁷ |     |     |
| `PATCH /orders/:id/status`        | ✅  | ✅  | ✅  | ✅  | ✅⁸ | ✅⁹ |
| `POST /payments`                  | ✅  | ✅  |     | ✅  |     | ✅¹⁰|
| `POST /payments/webhook`          | ✅  | ✅¹¹|     | ✅  |     |     |
| `GET /orders/:orderId/payment`    |     | ✅  |     | ✅⁷ |     |     |

1. `404` only on `GET /products/:productId`.
2. Referenced category does not exist.
3. A product with the same name already exists.
4. `COUNTER`/`PICKUP` placed by a user without attend privilege.
5. A product is not on the business unit's menu.
6. Price mismatch, product inactive, or product unavailable.
7. Missing **or** not visible to the caller (same `404`, no enumeration leak).
8. Concurrent status change (optimistic lock).
9. Illegal state transition.
10. Order not payable: not `PENDING`, or already has a payment.
11. Missing/invalid `x-webhook-secret`.

---

## 6. TypeScript types

Copy-paste contracts mirroring the backend response DTOs and value objects. **Money fields are
`string`** in these interfaces (decimal strings), **except `ProductResponse.price`, which is a
`number`**. Date fields are ISO-8601 `string`s.

```ts
// ---------- Enums (string unions) ----------

export type UserRole = 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'KITCHEN' | 'CUSTOMER';

export type OrderChannel = 'APP' | 'WEB' | 'TOTEM' | 'COUNTER' | 'PICKUP';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'CASH' | 'VOUCHER';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REFUSED' | 'CANCELLED';

// ---------- Order state machine (mirrors order-status.ts) ----------
// DELIVERED and CANCELLED are terminal. Use this to compute legal next states in the UI.

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_STATUS_TRANSITIONS[from].includes(to);

// ---------- Shared envelopes ----------

export interface PaginationMeta {
  limit: number;
  nextCursor: string | null; // null when there are no more pages
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorEnvelope {
  statusCode: number;
  error: string; // standard reason phrase, e.g. "Unprocessable Entity"
  message: string;
  path: string;
  timestamp: string; // ISO-8601
}

// ---------- Responses ----------

export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number; // NOTE: number on responses (sent as a decimal string on create)
  isActive: boolean;
  categoryId: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  imageUrl: string;
}

export interface OrderItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string; // decimal string
  subtotal: string; // decimal string (server-computed)
  notes: string | null;
}

export interface OrderResponse {
  id: string;
  businessUnitId: string;
  customerId: string | null;
  attendantId: string | null;
  pointsRedeemed: number;
  pointsEarned: number;
  totalAmount: string; // decimal string (server-computed)
  notes: string | null;
  orderChannel: OrderChannel;
  orderStatus: OrderStatus;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  updatedById: string | null;
  orderItems: OrderItemResponse[];
}

export interface PaymentResponse {
  id: string;
  orderId: string;
  amount: string; // decimal string (the order's authoritative total)
  method: PaymentMethod;
  status: PaymentStatus;
  extTransactionId: string | null;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

// ---------- Request bodies ----------

export interface LoginRequest {
  username: string;
  password: string; // min 8 chars
}

export interface LoginResponse {
  access_token: string;
}

export interface ProductCreateRequest {
  name: string; // <= 100
  description?: string; // <= 255
  price: string; // positive decimal string, up to 8 integer + 2 fractional digits
  categoryId: string; // uuid
  imageUrl: string; // URL, <= 2000
}

export interface OrderItemInput {
  productId: string; // uuid
  quantity: number; // integer >= 1
  unitPrice: string; // decimal string (<= 2 dp); MUST match the menu price
  notes?: string; // <= 150
}

export interface OrderCreateRequest {
  businessUnitId: string; // uuid
  customerId?: string; // uuid; only honored on COUNTER/PICKUP
  pointsRedeemed?: number; // integer >= 0
  notes?: string; // <= 150
  orderChannel: OrderChannel;
  orderItems: OrderItemInput[]; // non-empty
}

export interface OrderUpdateStatusRequest {
  orderStatus: OrderStatus; // must be a legal transition from the current status
}

export interface CreatePaymentRequest {
  orderId: string; // uuid
  method: PaymentMethod;
  // No amount: the server charges the order's authoritative totalAmount.
}

// ---------- Inventory (admin) ----------
// Derived from the frontend; not yet re-verified against the backend.

export type InventoryAdjustmentType = 'IN' | 'OUT';

export interface InventoryItem {
  id: string;
  businessUnitId: string;
  productId: string;
  quantity: number;
  minQuantity: number;
  updatedAt: string; // ISO-8601
}

export interface AdjustInventoryRequest {
  productId: string;
  type: InventoryAdjustmentType;
  quantity: number; // integer >= 1
  reason: string;
}

// ---------- Promotions (admin) ----------
// FREE_ITEM is a valid DiscountType elsewhere but is rejected for promotions.

export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Promotion {
  id: string;
  businessUnitId: string;
  name: string;
  discountType: PromotionDiscountType;
  discountValue: string; // decimal string; percent when PERCENTAGE
  minOrderValue: string; // decimal string
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

export interface CreatePromotionRequest {
  businessUnitId: string;
  name: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  minOrderValue: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export type UpdatePromotionRequest = Partial<
  Omit<CreatePromotionRequest, 'businessUnitId'>
>;
```

---

## Appendix — Source map (backend)

For maintainers keeping this doc in sync. Paths are relative to the backend repo root.

| Concern                         | File                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| Global prefix `/api`, Swagger   | `src/main.ts`                                                              |
| Global guard / pipe / filter    | `src/app.module.ts`                                                       |
| JWT payload                     | `src/shared/auth/jwt-payload.type.ts`                                     |
| Auth/role logic                 | `src/shared/auth/auth.guard.ts`, `roles.decorator.ts`, `public.decorator.ts` |
| Error envelope / kinds          | `src/shared/errors/error-envelope.type.ts`, `errors.type.ts`, `src/shared/filter/global-error.filter.ts` |
| Pagination                      | `src/shared/pagination/`                                                  |
| Login                           | `src/modules/identity/.../auth.controller.ts`, `sign-in-request.dto.ts`   |
| Products                        | `src/modules/business-units/.../products.controller.ts`, `product-*.dto.ts` |
| Orders                          | `src/modules/orders/.../orders.controller.ts`, `order-*.dto.ts`, `create-order.use-case.ts`, `update-order-status.use-case.ts` |
| Order channel / status VOs      | `src/modules/orders/domain/value-objects/order-channel.ts`, `order-status.ts` |
| Payments                        | `src/modules/payments/.../payments.controller.ts`, `create-payment.dto.ts`, `payment-webhook.dto.ts`, `create-payment.use-case.ts`, `confirm-payment.use-case.ts` |
| Payment method / status VOs     | `src/modules/payments/domain/value-objects/payment-method.ts`, `payment-status.ts` |
| Webhook secret guard            | `src/modules/payments/.../guards/payment-webhook.guard.ts`                |
| Mock gateway                    | `src/modules/payments/.../gateway/mock-payment-gateway.ts`                |
