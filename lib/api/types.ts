export type Role = 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'KITCHEN' | 'CUSTOMER'

export type OrderChannel = 'APP' | 'WEB' | 'TOTEM' | 'COUNTER' | 'PICKUP'

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'

export type PaymentMethod =
  'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'CASH' | 'VOUCHER'

export type PaymentStatus =
  'PENDING' | 'PROCESSING' | 'APPROVED' | 'REFUSED' | 'CANCELLED' | 'REFUNDED'

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'

export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUSTMENT'

export type Paginated<T> = {
  data: T[]
  meta: {
    limit: number
    nextCursor: string | null
    hasMore: boolean
  }
}

export type PaginationQuery = {
  limit?: number
  cursor?: string
  search?: string
  categoryId?: string
}

// --- Products ---

export type ProductResponseDto = {
  id: string
  name: string
  description: string | null
  /** Decimal string (BRL), e.g. "58.90". Never do float arithmetic on it. */
  price: string
  isActive: boolean
  categoryId: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type CreateProductRequest = {
  name: string
  description?: string
  /** Decimal string, positive, ≤2 decimal places. */
  price: string
  categoryId: string
  /**
   * Optional since backend 5.0.0. The intended flow is create the product,
   * then attach the image to the product that now exists — see
   * {@link ProductImageUploadUrl}.
   */
  imageUrl?: string
}

/**
 * `PATCH /products/:productId` (ADMIN only) — every field optional; send only
 * the ones that changed. `isActive` is not editable here (use the
 * activate/deactivate routes). `description` cannot be cleared to null.
 */
export type ProductUpdateDto = {
  name?: string
  description?: string
  /** Decimal string, positive, ≤2 decimal places. */
  price?: string
  categoryId?: string
  /**
   * `null` clears the reference only — the stored object stays in the bucket
   * (a backend concern). Note this route is ADMIN-only while the image
   * upload/confirm pair below is ADMIN+MANAGER, so a MANAGER may replace an
   * image but not clear one.
   */
  imageUrl?: string | null
}

/**
 * Content types the bucket accepts. `image/svg+xml` is deliberately absent.
 * The runtime allowlist lives in `lib/validation/constants.ts` so the browser
 * pre-check and the route handler's zod schema read the same array.
 */
export type ProductImageContentType = 'image/png' | 'image/jpeg' | 'image/webp'

/**
 * `POST /products/:productId/image/upload-url` (ADMIN/MANAGER) — mints a
 * short-lived credential for a direct browser→storage PUT. Answers `201`, but
 * nothing is persisted: a mint that is never used changes nothing, and a mint
 * is never reused after a failure.
 */
export type ProductImageUploadUrl = {
  /** Absolute storage URL; the credential is in the query string. */
  signedUrl: string
  token: string
  /**
   * Opaque, server-shaped. Echo it back to `/image/confirm` verbatim — the
   * server re-parses it against the product and answers 422 on anything it did
   * not shape itself.
   */
  path: string
  /** Fixed at 7200 by the provider; treat expiry as "start over at step 1". */
  expiresInSeconds: number
}

// --- Categories ---

export type Category = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** `POST /categories` (ADMIN) — born active; never send isActive/id. */
export type CreateCategoryRequest = {
  name: string
  description?: string
}

/** `PATCH /categories/:id` (ADMIN) — at least one field; isActive soft-deletes. */
export type UpdateCategoryRequest = {
  name?: string
  description?: string
  isActive?: boolean
}

/** `GET /categories` filters (public) — only active categories are listed. */
export type ListCategoriesQuery = {
  limit?: number
  cursor?: string
  search?: string
}

// --- Business Units ---

/**
 * Public view returned by `GET /business-units[/:id]` — no cnpj, isActive or
 * timestamps.
 */
export type PublicBusinessUnit = {
  id: string
  name: string
  address: string
  city: string
  phone: string
}

/** Full view returned by the `internal` (ADMIN/MANAGER) endpoints. */
export type BusinessUnit = PublicBusinessUnit & {
  cnpj: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateBusinessUnitRequest = {
  name: string
  /** 14 digits, no mask. */
  cnpj: string
  address: string
  city: string
  phone: string
}

/**
 * `PATCH /business-units/:id` (ADMIN) — partial update; at least one field.
 * cnpj is immutable and isActive is only editable through the activate/
 * deactivate routes, so neither is accepted here.
 */
export type UpdateBusinessUnitRequest = {
  name?: string
  address?: string
  city?: string
  phone?: string
}

// --- Users ---

/** Mirrors the backend UserResponse. */
export type User = {
  id: string
  username: string
  name: string
  email: string | null
  phone: string | null
  role: Role
  /** Units the staff user is bound to; [] when unbound (e.g. CUSTOMER). */
  businessUnitIds: string[]
  isActive: boolean
}

export type RegisterRequest = {
  username: string
  email?: string
  password: string
  name: string
  phone?: string
}

/** `POST /users` (ADMIN/MANAGER) — staff/admin creation. */
export type CreateStaffUserRequest = {
  name: string
  username: string
  password: string
  role: Role
  email?: string
  phone?: string
  businessUnitIds?: string[]
}

/** `GET /users` filters (all substrings except businessUnitId and role). */
export type ListUsersQuery = {
  limit?: number
  cursor?: string
  businessUnitId?: string
  username?: string
  email?: string
  /**
   * Plain AND filter, **not** a scope widener. CUSTOMERs carry no unit links,
   * so `role=CUSTOMER` only returns rows for an ADMIN who sends no
   * `businessUnitId`; a MANAGER (pinned to their claim) always gets an empty
   * page. See docs — `frontend-users-and-business-units.md` §1.3.
   */
  role?: Role
}

/** `PATCH /users/me` — at least one field required. */
export type UpdateMeRequest = {
  name?: string
  phone?: string
}

/** `PATCH /users/me/password`. */
export type ChangeMyPasswordRequest = {
  currentPassword: string
  newPassword: string
}

// --- Auth ---

export type LoginRequest = { username: string; password: string }

export type LoginResponse = {
  access_token: string
  refresh_token: string
}

export type RefreshRequest = { refresh_token: string }
export type LogoutRequest = { refresh_token: string }

// --- Menu ---

/** Public view: product + effective unit price, available items only. */
export type PublicMenuItem = {
  menuItemId: string
  productId: string
  name: string
  description: string | null
  imageUrl: string | null
  /** Effective price at the unit (decimal string). */
  price: string
}

/** Management view (`/menu/manage`), includes unavailable items. */
export type MenuItem = {
  id: string
  businessUnitId: string
  productId: string
  customPrice: string
  isAvailable: boolean
  createdAt: string
  updatedAt: string
}

export type AddMenuItemRequest = {
  productId: string
  /** Decimal string, positive, ≤2 decimal places. */
  customPrice: string
  isAvailable?: boolean
}

/** At least one field required. */
export type UpdateMenuItemRequest = {
  customPrice?: string
  isAvailable?: boolean
}

// --- Orders ---

export type OrderItem = {
  id: string
  productId: string
  /**
   * The product's name **at the moment the order was placed** — a snapshot the
   * server resolves from the authoritative menu read, never sent by us and
   * never null. Render it directly: looking the name up from the catalog by
   * `productId` shows the *current* name, so a rename would rewrite history and
   * a retired product would render nothing at all. Safe to cache with the
   * order; unlike `customerName`, it cannot go stale.
   */
  productName: string
  quantity: number
  unitPrice: string
  subtotal: string
  notes: string | null
}

export type Order = {
  id: string
  businessUnitId: string
  customerId: string | null
  /**
   * The name to call the order by (doc §5). For a guest order (no `customerId`)
   * this is the typed walk-in name; for an account order it is the customer's
   * current name, resolved live from their user record on every read — so never
   * cache it as immutable order data.
   */
  customerName: string | null
  attendantId: string | null
  pointsRedeemed: number
  pointsEarned: number
  /** Decimal string — authoritative, computed server-side. */
  totalAmount: string
  notes: string | null
  orderChannel: OrderChannel
  orderStatus: OrderStatus
  createdAt: string
  updatedAt: string
  updatedById: string | null
  orderItems: OrderItem[]
}

export type CreateOrderItemRequest = {
  productId: string
  quantity: number
  /** Decimal string, ≤2 decimal places. */
  unitPrice: string
  notes?: string
}

export type CreateOrderRequest = {
  businessUnitId: string
  /** Only used for COUNTER/PICKUP channels (attendant-placed orders). Never
   * sent together with `customerName` — the API and a DB constraint reject it. */
  customerId?: string
  /** Walk-in / "call the order by" name. Required for TOTEM and for a
   * COUNTER/PICKUP walk-in; rejected for APP/WEB (doc §3). Max 60 chars. */
  customerName?: string
  /** Loyalty points to redeem (integer ≥0). */
  pointsRedeemed?: number
  notes?: string
  orderChannel: OrderChannel
  orderItems: CreateOrderItemRequest[]
}

export type UpdateOrderStatusRequest = { orderStatus: OrderStatus }

export type OrderSortField = 'createdAt' | 'totalAmount'
export type SortDirection = 'asc' | 'desc'

/** `GET /orders` (staff) filters. */
export type ListOrdersQuery = {
  limit?: number
  cursor?: string
  businessUnitId?: string
  orderChannel?: OrderChannel
  orderStatus?: OrderStatus
  attendantId?: string
  customerId?: string
  /** ISO instant, inclusive. */
  createdAtFrom?: string
  /** ISO instant, inclusive. */
  createdAtTo?: string
  /** Decimal string, inclusive. */
  minTotal?: string
  /** Decimal string, inclusive. */
  maxTotal?: string
  sortBy?: OrderSortField
  sortDir?: SortDirection
}

/** `GET /orders/me` (customer) filters — cursor-paginated. */
export type ListMyOrdersQuery = {
  limit?: number
  cursor?: string
  orderChannel?: OrderChannel
  orderStatus?: OrderStatus
}

// --- Payments ---

export type Payment = {
  id: string
  orderId: string
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  extTransactionId: string | null
  /** Front-side extra (mock only) — the backend does not return a BR Code. */
  pixCode?: string | null
  createdAt: string
  updatedAt: string
}

export type CreatePaymentRequest = {
  orderId: string
  method: PaymentMethod
}

// --- Loyalty ---

export type LoyaltyTransaction = {
  id: string
  type: LoyaltyTransactionType
  points: number
  description: string
  createdAt: string
}

export type LoyaltyAccount = {
  id: string
  customerId: string
  totalPoints: number
  consentGiven: boolean
  consentDate: string | null
  /** Instant of LGPD consent revocation; null while consent is active. */
  consentRevokedAt: string | null
  createdAt: string
  /** Front-side enrichment (mock only); not returned by the backend. */
  transactions?: LoyaltyTransaction[]
}

// --- AI assistant ---

/**
 * A per-user token wallet an ADMIN grants and tops up. `tokenBalance` is a plain
 * integer token count (not money) — format it with a thousands separator.
 *
 * The wallet is global (not per business unit) and is in exactly one of three
 * states: not enrolled (`GET /me` → 404), active (`revokedAt === null`) or
 * revoked (`revokedAt !== null`, balance preserved but all AI use blocked).
 */
export type AiMembership = {
  id: string
  userId: string
  tokenBalance: number
  createdAt: string
  /**
   * ISO instant the membership was soft-revoked, `null` while active. This is
   * the single source of truth for the revoked state — never infer it from the
   * balance or from an error message.
   */
  revokedAt: string | null
}

/** `POST /ai/memberships/:userId` body — the initial grant. */
export type EnrollAiMembershipRequest = {
  /** Integer in [0, 2_147_483_647]. */
  initialBalance: number
}

/** `PATCH /ai/memberships/:userId/balance` body — signed, non-zero delta. */
export type AdjustAiMembershipBalanceRequest = {
  /** Non-zero integer in [-2_147_483_647, 2_147_483_647]. Positive credits. */
  delta: number
}

/** Only plain user/model turns are accepted — the server strips tool turns. */
export type ChatRole = 'user' | 'model'

export type ChatTurn = {
  role: ChatRole
  /** Non-empty, max 4000 chars. */
  text: string
}

/**
 * `POST /ai/chat` body. Threads live server-side: omit `conversationId` to open
 * a new one, then echo back the id the response carries on every follow-up.
 */
export type SendChatMessageRequest = {
  /**
   * The thread to continue. Omit to start a new one. When set, the server
   * replays its own stored turns and **ignores `history` entirely**.
   */
  conversationId?: string
  /** Required, non-empty, max 4000. */
  message: string
  /**
   * Legacy seed turns, max 50. Only meaningful on the first message of a
   * thread — silently discarded whenever `conversationId` is present.
   */
  history?: ChatTurn[]
}

export type ChatResponse = {
  /** Server-issued thread id — persist it and send it back on the next call. */
  conversationId: string
  /** The assistant's answer — render as the next `model` turn. */
  reply: string
  /** Tokens metered for this exchange (may span several internal model calls). */
  tokensSpent: number
  /** Caller's balance after this exchange — drive the balance display from it. */
  balanceRemaining: number
  /**
   * The open thread's title, sent on every exchange (server-derived on the
   * first message, unchanged thereafter). Use it as the chat header — never
   * null/empty.
   */
  conversationTitle: string
}

/**
 * Roles on a *stored* transcript are uppercase, unlike the lowercase
 * `'user' | 'model'` of {@link ChatTurn} used by the `history` request field.
 * They are not interchangeable — lowercase before ever feeding one back.
 */
export type AiConversationRole = 'USER' | 'MODEL'

export type AiConversationMessage = {
  id: string
  role: AiConversationRole
  content: string
  createdAt: string
}

/** Row of `GET /ai/conversations` — self-scoped, last activity first. */
export type AiConversationSummary = {
  id: string
  /**
   * Server-derived from the first user message, then user-editable via rename.
   * Never null/empty. Render as text (never HTML) — it is user-authored. Flows
   * unchanged into {@link AiConversationDetail}.
   */
  title: string
  /** Soft delete. A deleted thread can no longer be read or continued. */
  isDeleted: boolean
  createdAt: string
  /** Last activity — the list is ordered by this, so it reorders as they chat. */
  updatedAt: string
}

/** `GET /ai/conversations/:id` — every stored turn, oldest first (uncapped). */
export type AiConversationDetail = AiConversationSummary & {
  messages: AiConversationMessage[]
}

/** Row of the ADMIN usage report. This shape carries user emails — admin only. */
export type AiMembershipUsage = {
  id: string
  userId: string
  /** `null` when the user record no longer resolves — render a placeholder. */
  userName: string | null
  userEmail: string | null
  /** Balance *right now* — independent of `tokensUsedInPeriod`. */
  tokenBalance: number
  /** Spend strictly inside the reported window. */
  tokensUsedInPeriod: number
  isRevoked: boolean
  revokedAt: string | null
  createdAt: string
}

/**
 * `GET /ai/memberships` (ADMIN). `periodFrom`/`periodTo` echo the window the
 * server actually applied — render those, not the local request assumption.
 */
export type AiUsageReport = Paginated<AiMembershipUsage> & {
  periodFrom: string
  periodTo: string
}

export type AiUsageReportQuery = {
  /** Inclusive ISO instant. Omit both bounds for the last 30 days. */
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

// --- Inventory ---

export type InventoryAdjustmentType = 'IN' | 'OUT'

export type InventoryItem = {
  id: string
  businessUnitId: string
  productId: string
  quantity: number
  minQuantity: number
  updatedAt: string
}

export type AdjustInventoryRequest = {
  productId: string
  type: InventoryAdjustmentType
  quantity: number
  reason: string
}

/**
 * `POST /inventory/:businessUnitId/items` — opens the first stock row for a
 * product at a unit. The 201 body is a plain {@link InventoryItem}.
 */
export type InitInventoryRequest = {
  productId: string
  quantity: number
  minQuantity: number
  reason: string
}

// --- Promotions ---

/**
 * The promotion schema only models PERCENTAGE and FIXED_AMOUNT. FREE_ITEM is a
 * valid {@link DiscountType} elsewhere but is rejected for promotions.
 */
export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'

export type Promotion = {
  id: string
  businessUnitId: string
  name: string
  discountType: PromotionDiscountType
  /** Decimal string, e.g. "10.00". For PERCENTAGE this is the percent. */
  discountValue: string
  /** Decimal string, e.g. "30.00". */
  minOrderValue: string
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Customer-facing view returned by
 * `GET /promotions/public/by-business-unit/:businessUnitId`. The server only
 * returns rows that are running right now, so `isActive` (always true here) and
 * `startDate` (always past) are deliberately absent, as are the timestamps —
 * asking the public route for them would be a leak, not a missing feature.
 */
export type PublicPromotion = {
  id: string
  businessUnitId: string
  name: string
  discountType: PromotionDiscountType
  /** Decimal string, e.g. "10.00". For PERCENTAGE this is the percent. */
  discountValue: string
  /** Decimal string, e.g. "30.00". "0.00" means no minimum. */
  minOrderValue: string
  /** Half-open: the first instant the promotion is no longer valid. */
  endDate: string
}

/**
 * The fields the discount math and the promotional copy need. Both
 * {@link Promotion} (admin) and {@link PublicPromotion} (customer) satisfy it,
 * so `lib/promotions.ts` works with either without widening the public shape.
 */
export type PromotionOffer = Pick<
  Promotion,
  'id' | 'name' | 'discountType' | 'discountValue' | 'minOrderValue' | 'endDate'
>

export type CreatePromotionRequest = {
  businessUnitId: string
  name: string
  discountType: PromotionDiscountType
  discountValue: string
  minOrderValue: string
  startDate: string
  endDate: string
  isActive: boolean
}

export type UpdatePromotionRequest = Partial<
  Omit<CreatePromotionRequest, 'businessUnitId'>
>

// --- Audit Logs ---

export type AuditLog = {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  /** Sanitized object (sensitive keys redacted) or null. */
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type ListAuditLogsQuery = {
  limit?: number
  cursor?: string
  /** ISO date-time bounds. */
  from?: string
  to?: string
  userId?: string
  action?: string
  entity?: string
  entityId?: string
}
