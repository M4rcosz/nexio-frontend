import { NextResponse } from 'next/server'
import { USE_MOCKS } from '@/lib/api/client'
import { getAdminContext } from '@/lib/auth/access'
import {
  getUpload,
  isAllowedUploadContentType,
  putUpload,
} from '@/lib/api/mocks/uploadStore'
import { PRODUCT_IMAGE_MAX_BYTES } from '@/lib/validation/constants'

/**
 * Stand-in for the storage bucket, used only in local development with mocks on.
 *
 * The real product-image flow PUTs the bytes straight from the browser to a
 * signed storage URL, bypassing this app entirely. With mocks there is no
 * bucket, so `mintProductImageUploadUrlMock` points `signedUrl` here instead:
 * PUT absorbs the file, GET serves it back, and the uploader's real three-call
 * sequence — progress events, cancel, the confirm round-trip — can be
 * exercised offline against something that actually renders.
 *
 * **Guarded twice on purpose.** `NEXT_PUBLIC_USE_MOCKS` is a supported *build*
 * mode, not a dev-only flag — `lib/env.ts` deliberately allows mocks in
 * production for demo deployments, and Vercel preview builds run with
 * NODE_ENV=production. So mocks alone would leave this live on a preview host.
 * The NODE_ENV check mirrors the `DevAccountSwitcher` precedent in
 * `app/[locale]/layout.tsx`.
 *
 * Even behind those guards it enforces what the real bucket enforces: staff
 * auth, the content-type allowlist and the size cap. An absorber that accepts
 * `text/html` from anyone and serves it back on this origin is a stored-XSS
 * sink, not a test fixture.
 */
function disabled() {
  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}

function enabled(): boolean {
  return USE_MOCKS && process.env.NODE_ENV !== 'production'
}

export async function PUT(req: Request) {
  if (!enabled()) return disabled()

  // The real bucket only accepts writes from a signed staff credential; without
  // this the route is an open, unauthenticated file host.
  const admin = await getAdminContext()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const path = new URL(req.url).searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Missing path.' }, { status: 400 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!isAllowedUploadContentType(contentType)) {
    return NextResponse.json({ error: 'Unsupported type.' }, { status: 415 })
  }

  // Check the declared length first: `arrayBuffer()` buffers the whole body, so
  // testing the size only afterwards means a multi-gigabyte PUT is held in
  // memory before it can be refused.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > PRODUCT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const body = await req.arrayBuffer()
  if (body.byteLength > PRODUCT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  putUpload(path, { body, contentType })
  return new NextResponse(null, { status: 200 })
}

export async function GET(req: Request) {
  if (!enabled()) return disabled()
  const path = new URL(req.url).searchParams.get('path')
  const stored = path ? getUpload(path) : undefined
  if (!stored) return disabled()
  return new NextResponse(stored.body, {
    headers: {
      // Always one of the three allowed image types — never whatever was sent.
      'content-type': stored.contentType,
      'x-content-type-options': 'nosniff',
      // Each upload gets a new path, so the URL changes on every replace and
      // there is nothing to bust.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
