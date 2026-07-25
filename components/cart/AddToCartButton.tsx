'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ProductResponseDto } from '@/lib/api/types'
import { useCartStore } from '@/lib/cart/store'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export function AddToCartButton({
  product,
  unitId,
  unitName,
  large = false,
}: {
  product: ProductResponseDto
  unitId: string
  unitName: string
  large?: boolean
}) {
  const setBusinessUnit = useCartStore((s) => s.setBusinessUnit)
  const addItem = useCartStore((s) => s.addItem)
  const cartUnitId = useCartStore((s) => s.businessUnitId)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [confirmingSwitch, setConfirmingSwitch] = useState(false)
  const tMenu = useTranslations('menu')
  const tCart = useTranslations('cart')

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 1800)
    return () => clearTimeout(t)
  }, [feedback])

  function commitAdd() {
    setBusinessUnit(unitId, unitName)
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: String(product.price),
      imageUrl: product.imageUrl ?? null,
    })
    setFeedback(tMenu('added'))
  }

  function handleAdd() {
    if (cartUnitId && cartUnitId !== unitId) {
      setConfirmingSwitch(true)
      return
    }
    commitAdd()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        className={
          large
            ? 'btn-primary w-full py-3 text-base'
            : 'btn-primary !px-3.5 !py-2'
        }
      >
        {feedback ? (
          <>
            <CheckIcon className="h-4 w-4" />
            {feedback}
          </>
        ) : (
          <>
            <PlusIcon className="h-4 w-4" />
            {tMenu('addToCart')}
          </>
        )}
      </button>

      {/* Switching units empties the cart, so it's destructive even though the
          button that triggers it isn't. */}
      <ConfirmDialog
        open={confirmingSwitch}
        title={tCart('switchUnitTitle')}
        message={tCart('switchUnitConfirm')}
        confirmLabel={tCart('switchUnitCta')}
        danger
        onConfirm={() => {
          setConfirmingSwitch(false)
          commitAdd()
        }}
        onCancel={() => setConfirmingSwitch(false)}
      />
    </>
  )
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
