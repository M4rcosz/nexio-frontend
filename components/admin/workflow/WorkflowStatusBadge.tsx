'use client'

import { useTranslations } from 'next-intl'

/**
 * The `enabled` flag, and nothing else. Unlike `PromotionStatusBadge` there is
 * no effective status to derive: a workflow has no date window, so "enabled"
 * is the whole truth — a SCHEDULE workflow that is enabled *is* running (§11).
 */
export function WorkflowStatusBadge({ enabled }: { enabled: boolean }) {
  const t = useTranslations('admin.workflows')
  return (
    <span className={enabled ? 'chip-success' : 'chip'}>
      {enabled ? t('statusEnabled') : t('statusDisabled')}
    </span>
  )
}
