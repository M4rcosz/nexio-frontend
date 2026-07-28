import type {
  BusinessUnit,
  Category,
  ProductResponseDto,
  ProductUpdateDto,
  Role,
  UpdateBusinessUnitRequest,
  UpdateCategoryRequest,
  User,
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

// --- Internal (staff) user ---

export type UserFormValues = {
  name: string
  email: string
  phone: string
  role: Role
  businessUnitIds: string[]
}

/** Mirrors `UpdateInternalUserInput`; kept structural so this stays server-free. */
export type UserPatch = {
  name?: string
  email?: string
  phone?: string | null
  role?: Role
  businessUnitIds?: string[]
}

export type UserPatchError = 'noChanges'

/**
 * Diff for the staff-user edit form.
 *
 * Sending an unchanged field is not merely wasteful here, it is fatal: the
 * backend has no update endpoint for profile fields, and `updateInternalUser`
 * rejects a patch that so much as *mentions* `name`/`email`/`phone`/`role`.
 * Posting the whole form therefore 501'd every save and made the one supported
 * operation — replacing the unit set — unreachable.
 *
 * `unitsEditable` reflects whether the actor may change unit bindings at all.
 * A MANAGER's `businessUnitIds` is discarded server-side, so diffing them would
 * emit a patch that can only come back as an error about an empty unit set —
 * naming units the actor is staring at. When false, units are left out entirely.
 */
export function buildUserPatch(
  form: UserFormValues,
  user: User,
  unitsEditable: boolean,
): PatchResult<UserPatch, UserPatchError> {
  const patch: UserPatch = {}

  const name = form.name.trim()
  if (name !== user.name) patch.name = name

  const email = form.email.trim()
  if (email !== (user.email ?? '')) patch.email = email

  // Both sides normalized the same way — mixing `||` and `??` here made a
  // stored `phone: ""` read as changed on an untouched form, which put `phone`
  // into the patch and brought the 501 straight back.
  const phone = form.phone.trim() || null
  if (phone !== (user.phone || null)) patch.phone = phone

  if (form.role !== user.role) patch.role = form.role

  if (unitsEditable) {
    // An ADMIN holds no unit bindings. Only diff that when the role is actually
    // changing — otherwise a stale row (ADMIN carrying units from seed data)
    // would emit `businessUnitIds: []` on a form the user never touched, for a
    // picker that is hidden at that role.
    const roleChanging = form.role !== user.role
    const nextUnits = form.role === 'ADMIN' ? [] : form.businessUnitIds
    if (form.role !== 'ADMIN' || roleChanging) {
      const prevUnits = user.businessUnitIds ?? []
      // Order carries no meaning — compare as sets.
      const same =
        nextUnits.length === prevUnits.length &&
        nextUnits.every((id) => prevUnits.includes(id))
      if (!same) patch.businessUnitIds = nextUnits
    }
  }

  if (Object.keys(patch).length === 0) return { error: 'noChanges' }
  return { patch }
}
