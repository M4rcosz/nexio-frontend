import { serverFetch, USE_MOCKS } from './client'
import type { AuditLog, ListAuditLogsQuery, Paginated } from './types'
import { listAuditLogsMock } from './mocks/audit-logs'

/**
 * `GET /audit-logs` (ADMIN) — cursor-paginated audit trail with optional
 * period (`from`/`to`), actor (`userId`), `action`, `entity` and `entityId`
 * filters.
 */
export async function listAuditLogs(
  query: ListAuditLogsQuery = {},
): Promise<Paginated<AuditLog>> {
  if (USE_MOCKS) {
    return listAuditLogsMock(query)
  }
  return serverFetch<Paginated<AuditLog>>('/audit-logs', {
    query: {
      limit: query.limit,
      cursor: query.cursor,
      from: query.from,
      to: query.to,
      userId: query.userId,
      action: query.action,
      entity: query.entity,
      entityId: query.entityId,
    },
    cache: 'no-store',
  })
}
