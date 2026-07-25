import type {
  BusinessUnit,
  Category,
  ProductResponseDto,
  ProductUpdateDto,
  UpdateBusinessUnitRequest,
  UpdateCategoryRequest,
} from '@/lib/api/types'

/**
 * Pure diff helpers shared by the admin edit forms. Each takes the raw form
 * values plus the loaded entity and returns either the minimal PATCH body
 * (only the fields that actually changed — never null/"") or a stable error
 * key that the calling component resolves through its own `t()` catalog.
 *
 * No React / next-intl dependency lives here so the diff logic can be unit
 * tested in isolation. The returned error strings are message keys, not
 * user-facing text.
 */
export type PatchResult<TPatch, TError extends string> =
  { patch: TPatch } | { error: TError }

const MONEY_RE = /^\d+(\.\d{1,2})?$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// --- Category ---

export type CategoryFormValues = {
  name: string
  description: string
  isActive: boolean
}

export type CategoryPatchError =
  'invalidName' | 'descriptionCannotBeCleared' | 'noChanges'

export function buildCategoryPatch(
  form: CategoryFormValues,
  category: Category,
): PatchResult<UpdateCategoryRequest, CategoryPatchError> {
  const patch: UpdateCategoryRequest = {}

  const name = form.name.trim()
  if (name !== category.name) {
    if (name.length < 2) return { error: 'invalidName' }
    patch.name = name
  }

  const description = form.description.trim()
  if (description !== (category.description ?? '')) {
    if (description) {
      patch.description = description
    } else if (category.description) {
      // Clearing an existing description is not supported by the domain.
      return { error: 'descriptionCannotBeCleared' }
    }
  }

  if (form.isActive !== category.isActive) {
    patch.isActive = form.isActive
  }

  if (Object.keys(patch).length === 0) return { error: 'noChanges' }
  return { patch }
}

// --- Business Unit ---

export type BusinessUnitFormValues = {
  name: string
  address: string
  city: string
  phone: string
}

export type BusinessUnitPatchError =
  | 'invalidName'
  | 'invalidAddress'
  | 'invalidCity'
  | 'invalidPhone'
  | 'noChanges'

export function buildBusinessUnitPatch(
  form: BusinessUnitFormValues,
  unit: BusinessUnit,
): PatchResult<UpdateBusinessUnitRequest, BusinessUnitPatchError> {
  const patch: UpdateBusinessUnitRequest = {}

  const name = form.name.trim()
  if (name !== unit.name) {
    if (name.length < 2) return { error: 'invalidName' }
    patch.name = name
  }

  const address = form.address.trim()
  if (address !== unit.address) {
    if (address.length < 2) return { error: 'invalidAddress' }
    patch.address = address
  }

  const city = form.city.trim()
  if (city !== unit.city) {
    if (city.length < 2) return { error: 'invalidCity' }
    patch.city = city
  }

  const phone = form.phone.trim()
  if (phone !== unit.phone) {
    if (phone.length < 3) return { error: 'invalidPhone' }
    patch.phone = phone
  }

  if (Object.keys(patch).length === 0) return { error: 'noChanges' }
  return { patch }
}

// --- Product ---

/**
 * Text fields only — the image is not edited through this patch. It is
 * attached with the upload/confirm pair and cleared with an explicit
 * `imageUrl: null` patch from `ProductImageManager`.
 */
export type ProductFormValues = {
  name: string
  description: string
  price: string
  categoryId: string
}

export type ProductPatchError =
  'invalidName' | 'invalidMoney' | 'invalidCategory' | 'noChanges'

export function buildProductPatch(
  form: ProductFormValues,
  product: ProductResponseDto,
): PatchResult<ProductUpdateDto, ProductPatchError> {
  const patch: ProductUpdateDto = {}

  const name = form.name.trim()
  if (name !== product.name) {
    if (name.length < 2) return { error: 'invalidName' }
    patch.name = name
  }

  // description cannot be cleared to null — only send it when non-empty.
  const description = form.description.trim()
  if (description && description !== (product.description ?? '')) {
    patch.description = description
  }

  const price = form.price.trim()
  if (price !== product.price) {
    if (!MONEY_RE.test(price) || Number(price) <= 0) {
      return { error: 'invalidMoney' }
    }
    patch.price = price
  }

  const categoryId = form.categoryId.trim()
  if (categoryId !== product.categoryId) {
    if (!UUID_RE.test(categoryId)) {
      return { error: 'invalidCategory' }
    }
    patch.categoryId = categoryId
  }

  if (Object.keys(patch).length === 0) return { error: 'noChanges' }
  return { patch }
}
