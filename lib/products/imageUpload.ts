// Browser side of the product-image upload. Three calls, two of which hit our
// own BFF routes; the bytes themselves go straight from the browser to storage
// and never pass through this app.
//
//   1. POST /api/products/:id/image/upload-url   -> signed credential
//   2. PUT  <signedUrl>                          -> the file (no auth of ours)
//   3. POST /api/products/:id/image/confirm      -> the updated product
//
// Two rules the callers must not have to remember, so they are enforced here:
//
//   - **A mint is never reused.** Every call to `uploadProductImage` mints its
//     own credential, and any failure after minting throws that credential
//     away. Nothing is persisted by a mint, so discarding one costs nothing —
//     whereas retrying a PUT against an expired or half-consumed credential
//     fails later and more confusingly, at confirm.
//   - **`path` is echoed back verbatim.** It is opaque and server-shaped; the
//     backend re-parses it against the product and answers 422 on anything it
//     did not shape itself.
import type {
  ProductImageContentType,
  ProductImageUploadUrl,
  ProductResponseDto,
} from '@/lib/api/types'
import {
  PRODUCT_IMAGE_CONTENT_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
} from '@/lib/validation/constants'

/**
 * Where the flow currently is. `idle` is both the start state and the state
 * every failure returns to — there is no partial progress to resume from.
 */
export type UploadPhase = 'idle' | 'minting' | 'uploading' | 'confirming'

export type UploadFailureCode =
  /** Client pre-check: `file.type` outside the allowlist (or an SVG). */
  | 'invalid_type'
  /** Client pre-check: over the 5 MB cap. */
  | 'too_large'
  /** 429 at mint — the 10-per-minute budget is spent. */
  | 'rate_limited'
  | 'mint_failed'
  /** The PUT to storage failed: network, CORS, or an expired credential. */
  | 'upload_failed'
  /** 404 at confirm — no object at that path; re-upload from step 1. */
  | 'upload_incomplete'
  /** 422 at confirm — the stored bytes were rejected; a different file is the fix. */
  | 'image_rejected'
  | 'confirm_failed'
  | 'cancelled'

export class ProductImageUploadError extends Error {
  constructor(
    readonly code: UploadFailureCode,
    readonly status: number | null = null,
  ) {
    super(code)
    this.name = 'ProductImageUploadError'
  }
}

/**
 * Local mirror of the checks the bucket and the API run server-side. Purely an
 * optimisation of the error path: it turns a round trip into an instant
 * message and, for an oversized file, avoids pushing megabytes at a bucket
 * that will refuse them. It is never the only guard.
 *
 * Returns `null` when the file is acceptable.
 */
export function precheckProductImage(
  file: File,
): 'invalid_type' | 'too_large' | null {
  if (!isAllowedContentType(file.type)) return 'invalid_type'
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'too_large'
  return null
}

function isAllowedContentType(type: string): type is ProductImageContentType {
  return (PRODUCT_IMAGE_CONTENT_TYPES as readonly string[]).includes(type)
}

async function readCode(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { code?: string } | null
  return body?.code ?? null
}

/** Parses a success body, turning malformed JSON into the step's failure code. */
async function readJson<T>(
  res: Response,
  failure: UploadFailureCode,
): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    throw new ProductImageUploadError(failure, res.status)
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * POSTs JSON to one of our own routes, turning a transport failure into the
 * step's own failure code. A cancel surfaces as `cancelled` rather than as the
 * step failing, so the UI can go quiet instead of showing an error the user
 * caused deliberately.
 */
async function postJson(
  url: string,
  body: unknown,
  signal: AbortSignal | undefined,
  failure: UploadFailureCode,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch {
    throw new ProductImageUploadError(signal?.aborted ? 'cancelled' : failure)
  }
}

/**
 * PUT the file to storage with upload progress.
 *
 * `XMLHttpRequest` rather than `fetch` purely for `upload.onprogress` — fetch
 * cannot report request-body progress, and a resumable-upload library would be
 * absurd for a 5 MB image.
 *
 * No `Authorization` header: this request goes to the storage provider, not to
 * our API, and the credential is already in the URL. Sending ours would leak
 * the session token to a third-party origin.
 */
function putToSignedUrl(
  signedUrl: string,
  file: File,
  signal: AbortSignal | undefined,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProductImageUploadError('cancelled'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    // The server checks what the bucket actually stored, not what was declared
    // at mint time, so this must be the file's real type or confirm fails.
    xhr.setRequestHeader('Content-Type', file.type)

    const onAbort = () => xhr.abort()
    signal?.addEventListener('abort', onAbort)
    const cleanup = () => signal?.removeEventListener('abort', onAbort)

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      }
    }
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ProductImageUploadError('upload_failed', xhr.status))
    }
    xhr.onerror = () => {
      cleanup()
      reject(new ProductImageUploadError('upload_failed', xhr.status || null))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new ProductImageUploadError('cancelled'))
    }
    xhr.send(file)
  })
}

/**
 * Runs the whole flow and resolves with the product returned by confirm.
 *
 * That response is authoritative — write it straight into the UI. Refetching
 * instead can race the CDN and hand back the pre-upload row.
 *
 * Every failure rejects with a {@link ProductImageUploadError} and leaves
 * nothing behind to clean up. In particular, a cancel mid-upload must **not**
 * be followed by a confirm: the object may or may not exist, it is referenced
 * by nothing either way, and confirming would either 404 or publish a
 * truncated file.
 */
export async function uploadProductImage({
  productId,
  file,
  signal,
  onPhase,
  onProgress,
}: {
  productId: string
  file: File
  signal?: AbortSignal
  onPhase?: (phase: UploadPhase) => void
  onProgress?: (fraction: number) => void
}): Promise<ProductResponseDto> {
  const problem = precheckProductImage(file)
  if (problem) throw new ProductImageUploadError(problem)

  onPhase?.('minting')
  const mintRes = await postJson(
    `/api/products/${productId}/image/upload-url`,
    { contentType: file.type },
    signal,
    'mint_failed',
  )
  if (!mintRes.ok) {
    throw new ProductImageUploadError(
      mintRes.status === 429 ? 'rate_limited' : 'mint_failed',
      mintRes.status,
    )
  }
  // A 2xx does not guarantee a JSON body — a proxy can return an HTML error
  // page with a 200. Parsing defensively keeps the documented invariant that
  // every rejection from here is a ProductImageUploadError, not a raw
  // SyntaxError the caller would have to special-case.
  const minted = await readJson<ProductImageUploadUrl>(mintRes, 'mint_failed')
  if (!isNonEmptyString(minted?.signedUrl) || !isNonEmptyString(minted?.path)) {
    throw new ProductImageUploadError('mint_failed', mintRes.status)
  }

  onPhase?.('uploading')
  onProgress?.(0)
  await putToSignedUrl(minted.signedUrl, file, signal, onProgress)
  // The browser is not obliged to fire a final `lengthComputable` event, so
  // drive the bar to 100% explicitly rather than leaving it stuck at 97%.
  onProgress?.(1)

  onPhase?.('confirming')
  const confirmRes = await postJson(
    `/api/products/${productId}/image/confirm`,
    // Verbatim. Do not rebuild, normalise or append a filename.
    { path: minted.path },
    signal,
    'confirm_failed',
  )
  if (!confirmRes.ok) {
    const code = await readCode(confirmRes)
    throw new ProductImageUploadError(
      code === 'upload_incomplete' || code === 'image_rejected'
        ? code
        : 'confirm_failed',
      confirmRes.status,
    )
  }

  const product = await readJson<ProductResponseDto>(
    confirmRes,
    'confirm_failed',
  )
  if (!product) {
    throw new ProductImageUploadError('confirm_failed', confirmRes.status)
  }
  return product
}
