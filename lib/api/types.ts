export type Role =
  | 'ADMIN'
  | 'MANAGER'
  | 'ATTENDANT'
  | 'KITCHEN'
  | 'CUSTOMER'

export type OrderChannel =
  | 'APP'
  | 'WEB'
  | 'TOTEM'
  | 'COUNTER'
  | 'PICKUP'

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED'

export type PaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PIX'
  | 'CASH'
  | 'VOUCHER'

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REFUSED'
  | 'CANCELLED'

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'

export type LoyaltyTransactionType =
  | 'EARN'
  | 'REDEEM'
  | 'EXPIRE'
  | 'ADJUSTMENT'

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

export type ProductResponseDto = {
  id: string
  name: string
  description: string | null
  price: number
  isActive: boolean
  categoryId: string
  imageUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  name: string
  description: string | null
}

export type BusinessUnit = {
  id: string
  name: string
  cnpj: string
  address: string
  city: string
  phone: string
  isActive: boolean
}

export type User = {
  id: string
  username: string
  email: string | null
  name: string
  phone: string | null
  role: Role
  businessUnitId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  productId: string
  productName?: string
  quantity: number
  unitPrice: string
  subtotal: string
  notes: string | null
}

export type Order = {
  id: string
  businessUnitId: string
  customerId: string
  attendantId: string | null
  orderChannel: OrderChannel
  orderStatus: OrderStatus
  totalAmount: string
  pointsEarned: number
  pointsRedeemed: number
  notes: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export type Payment = {
  orderId: string
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  extTransactionId: string | null
  pixCode?: string | null
  createdAt?: string
  updatedAt?: string
}

export type LoyaltyTransaction = {
  id: string
  type: LoyaltyTransactionType
  points: number
  description: string
  createdAt: string
}

export type LoyaltyAccount = {
  customerId: string
  totalPoints: number
  consentGiven: boolean
  consentDate: string | null
  transactions?: LoyaltyTransaction[]
}

export type LoginRequest = { username: string; password: string }
export type LoginResponse = { access_token: string }

export type RegisterRequest = {
  username: string
  email: string
  password: string
  name: string
  phone?: string
}

export type CreateOrderRequest = {
  businessUnitId: string
  orderChannel: OrderChannel
  items: Array<{ productId: string; quantity: number; notes?: string }>
  notes?: string
}

export type CreatePaymentRequest = {
  method: PaymentMethod
}
