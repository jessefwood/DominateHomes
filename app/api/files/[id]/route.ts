import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@/lib/session'
import { DOWNLOAD_LINK_SECONDS, signedDownloadUrl, storageConfigured } from '@/lib/storage'
import { requireUploadAccess } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

/**
 * The only way to read a file.
 *
 * The bucket is private, so there is no address a browser can reach on its
 * own. This route proves the person asking may see the file, mints a link
 * that stops working in ten minutes, and redirects to it. The link is never
 * stored, never rendered into a page, and never reaches anything that keeps
 * history, because the browser follows the redirect and the address bar still
 * shows this route.
 *
 * Which matters for the thing clients actually do, which is forward a page to
 * a husband or a builder. What gets forwarded is `/api/files/<id>`, and that
 * is checked again against whoever opens it.
 *
 * A signed-out visitor gets a 404 rather than a redirect to sign in. A
 * redirect would confirm the file exists, and the id is the only secret
 * protecting a file whose project the visitor is not on.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const user = await currentUser()

  if (!user) return new NextResponse('Not found', { status: 404 })
  if (!storageConfigured()) return new NextResponse('Not found', { status: 404 })

  // Answers notFound() for a file on a project this person is not on, which
  // Next turns into the 404 page.
  const { upload } = await requireUploadAccess(user, id)

  if (upload.deletedAt || !upload.confirmedAt) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Without `download`, the browser shows what it can, which is what a
  // preview needs. With it, the file saves under the name it had on their
  // phone rather than under its storage key.
  const wantsDownload = request.nextUrl.searchParams.get('download') === '1'

  const location = signedDownloadUrl(upload.storageKey, {
    expires: DOWNLOAD_LINK_SECONDS,
    download: wantsDownload ? upload.filename : undefined,
  })

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: location,
      // The redirect carries a working link in a header. It must not be
      // cached by anything in between, and it must not be kept by the
      // browser past the moment it is followed.
      'Cache-Control': 'private, no-store, max-age=0',
      // A referrer would leak our file id to the storage host. There is no
      // reason for it to know.
      'Referrer-Policy': 'no-referrer',
    },
  })
}
