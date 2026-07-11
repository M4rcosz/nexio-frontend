'use client'

import { useState } from 'react'
import { AdjustStockForm } from '@/components/admin/AdjustStockForm'
import {
  InitStockForm,
  type InitPrefill,
} from '@/components/admin/InitStockForm'

type ProductOption = { id: string; name: string }

/**
 * Composes the adjust + init stock forms and hands prefill state between them:
 * an adjustment that 404s ("no balance yet") seeds the init form; an init that
 * 409s ("already exists") points back at the adjustment form.
 */
export function InventoryForms({
  businessUnitId,
  products,
}: {
  businessUnitId: string
  products: ProductOption[]
}) {
  const [initPrefill, setInitPrefill] = useState<InitPrefill | null>(null)
  const [adjustProductId, setAdjustProductId] = useState<string | null>(null)

  function scrollTo(containerId: string, focusId: string) {
    document
      .getElementById(containerId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.getElementById(focusId)?.focus()
  }

  return (
    <div className="space-y-6">
      <div id="inventory-adjust" className="card p-6">
        <AdjustStockForm
          businessUnitId={businessUnitId}
          products={products}
          prefillProductId={adjustProductId}
          onInitRequest={(productId, quantity) => {
            setInitPrefill({ productId, quantity })
            scrollTo('inventory-init', 'init-product')
          }}
        />
      </div>
      <div id="inventory-init" className="card p-6">
        <InitStockForm
          businessUnitId={businessUnitId}
          products={products}
          prefill={initPrefill}
          onAdjustRequest={(productId) => {
            setAdjustProductId(productId)
            scrollTo('inventory-adjust', 'adjust-product')
          }}
        />
      </div>
    </div>
  )
}
