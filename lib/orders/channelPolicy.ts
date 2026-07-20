import type { OrderChannel } from '@/lib/api/types'

/**
 * The per-channel policy table from doc §3 — the single source of truth for who
 * the customer is, whether a staff attendant is required, and whether a name is
 * required. Derive form behaviour from this table instead of scattering
 * `if (channel === ...)` across components: the backend keeps it in one table
 * for exactly that reason and the frontend mirrors it.
 *
 * | Channel | Staff actor | customerId        | customerName                 |
 * | ------- | ----------- | ----------------- | ---------------------------- |
 * | APP     | no          | from JWT (no body)| rejected                     |
 * | WEB     | no          | from JWT (no body)| rejected                     |
 * | TOTEM   | no          | never set         | required                     |
 * | COUNTER | yes         | optional (body)   | required only if no customerId |
 * | PICKUP  | yes         | optional (body)   | required only if no customerId |
 */
export type ChannelPolicy = {
  channel: OrderChannel
  /** COUNTER/PICKUP: a staff attendant must place the order. */
  requiresStaffActor: boolean
  /** COUNTER/PICKUP: a `customerId` may be sent in the body. */
  allowsCustomerId: boolean
  /** APP/WEB: sending a `customerName` is rejected (identity is the JWT). */
  nameRejected: boolean
  /** TOTEM: a `customerName` is always required. */
  nameAlwaysRequired: boolean
}

const POLICIES: Record<OrderChannel, ChannelPolicy> = {
  APP: {
    channel: 'APP',
    requiresStaffActor: false,
    allowsCustomerId: false,
    nameRejected: true,
    nameAlwaysRequired: false,
  },
  WEB: {
    channel: 'WEB',
    requiresStaffActor: false,
    allowsCustomerId: false,
    nameRejected: true,
    nameAlwaysRequired: false,
  },
  TOTEM: {
    channel: 'TOTEM',
    requiresStaffActor: false,
    allowsCustomerId: false,
    nameRejected: false,
    nameAlwaysRequired: true,
  },
  COUNTER: {
    channel: 'COUNTER',
    requiresStaffActor: true,
    allowsCustomerId: true,
    nameRejected: false,
    nameAlwaysRequired: false,
  },
  PICKUP: {
    channel: 'PICKUP',
    requiresStaffActor: true,
    allowsCustomerId: true,
    nameRejected: false,
    nameAlwaysRequired: false,
  },
}

export function getChannelPolicy(channel: OrderChannel): ChannelPolicy {
  return POLICIES[channel]
}

export function requiresStaffActor(channel: OrderChannel): boolean {
  return POLICIES[channel].requiresStaffActor
}

export function allowsCustomerId(channel: OrderChannel): boolean {
  return POLICIES[channel].allowsCustomerId
}

export function nameRejected(channel: OrderChannel): boolean {
  return POLICIES[channel].nameRejected
}

/**
 * Whether a `customerName` is required for this channel given whether the
 * caller already has a `customerId`. TOTEM always requires one; COUNTER/PICKUP
 * require it only for a walk-in (no `customerId`); APP/WEB never do (and in fact
 * reject it).
 */
export function nameRequired(
  channel: OrderChannel,
  hasCustomerId: boolean,
): boolean {
  const policy = POLICIES[channel]
  if (policy.nameRejected) return false
  if (policy.nameAlwaysRequired) return true
  if (policy.allowsCustomerId) return !hasCustomerId
  return false
}

/**
 * A structurally exclusive description of who the order is for. Because the API
 * (and a DB constraint) reject `customerId` and `customerName` together, this
 * union makes it awkward to construct an invalid request rather than merely
 * documenting the rule:
 *
 * - `jwt`     → APP/WEB; identity comes from the token, no body fields
 * - `account` → COUNTER/PICKUP serving a registered customer (`customerId`)
 * - `name`    → TOTEM, or a COUNTER/PICKUP walk-in (`customerName`)
 */
export type CustomerIdentity =
  | { kind: 'jwt' }
  | { kind: 'account'; customerId: string }
  | { kind: 'name'; customerName: string }

/**
 * Projects a {@link CustomerIdentity} onto the request fields, guaranteeing the
 * two never appear together. Callers spread the result into the create-order
 * body.
 */
export function customerFields(identity: CustomerIdentity): {
  customerId?: string
  customerName?: string
} {
  switch (identity.kind) {
    case 'account':
      return { customerId: identity.customerId }
    case 'name':
      return { customerName: identity.customerName }
    case 'jwt':
      return {}
  }
}
