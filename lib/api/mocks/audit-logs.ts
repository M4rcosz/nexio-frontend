// Mock fallback for the `/audit-logs` endpoint (USE_MOCKS only).
import type { AuditLog, ListAuditLogsQuery, Paginated } from '@/lib/api/types'
import { mockDelay } from './_delay'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString()
}

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    userId: 'usr_admin_demo',
    action: 'LOGIN_SUCCESS',
    entity: 'User',
    entityId: 'usr_admin_demo',
    metadata: { ip: '203.0.113.10' },
    createdAt: hoursAgo(1),
  },
  {
    id: 'aud_2',
    userId: 'usr_manager_recife',
    action: 'INVENTORY_ADJUSTED',
    entity: 'Inventory',
    entityId: 'inv_1',
    metadata: { type: 'IN', quantity: 10 },
    createdAt: hoursAgo(5),
  },
  {
    id: 'aud_3',
    userId: null,
    action: 'PAYMENT_APPROVED',
    entity: 'Payment',
    entityId: 'pay_demo',
    metadata: null,
    createdAt: hoursAgo(26),
  },
]

export async function listAuditLogsMock(
  query: ListAuditLogsQuery = {},
): Promise<Paginated<AuditLog>> {
  await mockDelay()
  let data = [...MOCK_AUDIT_LOGS]
  if (query.userId) data = data.filter((l) => l.userId === query.userId)
  if (query.action) data = data.filter((l) => l.action === query.action)
  if (query.entity) data = data.filter((l) => l.entity === query.entity)
  if (query.entityId) data = data.filter((l) => l.entityId === query.entityId)
  if (query.from) data = data.filter((l) => l.createdAt >= query.from!)
  if (query.to) data = data.filter((l) => l.createdAt <= query.to!)
  return { data, meta: { limit: 20, nextCursor: null, hasMore: false } }
}
