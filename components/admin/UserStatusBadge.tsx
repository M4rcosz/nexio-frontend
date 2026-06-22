import { useTranslations } from 'next-intl'

export function UserStatusBadge({ active }: { active: boolean }) {
  const t = useTranslations('admin.users')
  if (active) {
    return (
      <span className="chip-success">
        <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
        {t('statusActive')}
      </span>
    )
  }
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-fg-subtle" />
      {t('statusInactive')}
    </span>
  )
}
