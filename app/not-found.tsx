import Link from 'next/link'
import { Logomark } from '@/components/logo'

export const metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

/**
 * A client landing on a bad link should not meet an unstyled framework page.
 * They probably arrived from an old email, so the two useful doors are the
 * front of the site and sign-in.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Logomark className="w-11 text-ink" title="Dominate Homes" />
      <p className="eyebrow mt-4">Dominate Homes</p>
      <h1 className="font-display mt-4 text-4xl leading-tight text-ink">
        That page is not here.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-driftwood-deep">
        The link may be out of date, or it may be part of a project you need to sign in to see.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-md bg-ink px-5 py-2.5 text-oyster transition-opacity hover:opacity-90"
        >
          Back to the start
        </Link>
        <Link
          href="/signin"
          className="hairline rounded-md border px-5 py-2.5 text-ink transition-colors hover:bg-sand/50"
        >
          Client login
        </Link>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-driftwood">
        If you were sent this link and it should work, text Davina and she will sort it out.
      </p>
    </div>
  )
}
