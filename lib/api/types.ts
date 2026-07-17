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
  imageUrl: string
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
  imageUrl?: string
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

/** `GET /users` filters (all substrings except businessUnitId). */
export type ListUsersQuery = {
  limit?: number
  cursor?: string
  businessUnitId?: string
  username?: string
  email?: string
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
  /** Front-side enrichment (mock only); the backend does not return names. */
  productName?: string
  quantity: number
  unitPrice: string
  subtotal: string
  notes: string | null
}

export type Order = {
  id: string
  businessUnitId: string
  customerId: string | null
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
  /** Only used for COUNTER/PICKUP channels (attendant-placed orders). */
  customerId?: string
  /** Loyalty points to redeem (integer ≥0). */
  pointsRedeemed?: number
  notes?: string
  orderChannel: OrderChannel
  orderItems: CreateOrderItemRequest[]
}

export type UpdateOrderStatusRequest = { orderStatus: OrderStatus }

/** `GET /orders` (staff) filters. */
export type ListOrdersQuery = {
  limit?: number
  cursor?: string
  businessUnitId?: string
  orderChannel?: OrderChannel
  orderStatus?: OrderStatus
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
 */
export type AiMembership = {
  id: string
  userId: string
  tokenBalance: number
  createdAt: string
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

/** `POST /ai/chat` body. `history` is replayed context (server is stateless). */
export type SendChatMessageRequest = {
  /** Required, non-empty, max 4000. */
  message: string
  /** Optional prior turns, max 50. */
  history?: ChatTurn[]
}

export type ChatResponse = {
  /** The assistant's answer — render as the next `model` turn. */
  reply: string
  /** Tokens metered for this exchange (may span several internal model calls). */
  tokensSpent: number
  /** Caller's balance after this exchange — drive the balance display from it. */
  balanceRemaining: number
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
