// In-memory stand-in for the product-images bucket, used only in mock mode.
//
// Shared deliberately: `app/api/dev/mock-upload` absorbs the browser's PUT and
// `confirmProductImageMock` has to answer "is there an object at this path?".
// When the store lived inside the route module, confirm could not see it, so
// the mock could only ever produce the happy path — and `upload_incomplete`,
// the branch the uploader treats specially, was unreachable offline.
//
// Process-local and bounded. Nothing here is persisted; a restart empties it,
// which is the same lifetime as MOCK_PRODUCTS itself.
import { PRODUCT_IMAGE_CONTENT_TYPES } from '@/lib/validation/constants'
import type { ProductImageContentType } from '@/lib/api/types'

export type StoredUpload = {
  body: ArrayBuffer
  contentType: ProductImageContentType
}

/**
 * Keep only the most recent uploads. Without a cap a long session — or anyone
 * poking at a mocks-enabled preview deploy — pins 5 MB per entry in the server
 * heap forever.
 */
const MAX_ENTRIES = 20

const uploads = new Map<string, StoredUpload>()

export function isAllowedUploadContentType(
  type: string,
): type is ProductImageContentType {
  return (PRODUCT_IMAGE_CONTENT_TYPES as readonly string[]).includes(type)
}

export function putUpload(path: string, entry: StoredUpload): void {
  // Re-inserting moves the key to the end, so eviction is genuine LRU-by-write
  // rather than "oldest key that was ever written".
  uploads.delete(path)
  uploads.set(path, entry)
  while (uploads.size > MAX_ENTRIES) {
    const oldest = uploads.keys().next().value
    if (oldest === undefined) break
    uploads.delete(oldest)
  }
}

export function getUpload(path: string): StoredUpload | undefined {
  return uploads.get(path)
}

export function hasUpload(path: string): boolean {
  return uploads.has(path)
}

/** Test seam — the store is module state shared across suites. */
export function resetUploads(): void {
  uploads.clear()
}
