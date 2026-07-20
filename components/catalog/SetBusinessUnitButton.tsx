'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useCartStore } from '@/lib/cart/store'

export function SetBusinessUnitButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const router = useRouter()
  const setBusinessUnit = useCartStore((s) => s.setBusinessUnit)
  const t = useTranslations('home')

  return (
    <button
      type="button"
      onClick={() => {
        setBusinessUnit(id, name)
        router.push(`/units/${id}`)
      }}
      className="btn-secondary"
    >
      {t('select')}
    </button>
  )
}
