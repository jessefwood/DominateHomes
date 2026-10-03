import Link from 'next/link'
import { Logomark } from '@/components/logo'
import { RequestForm } from './form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ask for portal access',
  description: 'Ask us to open a Dominate Homes portal for your project.',
  robots: { index: false, follow: false },
}

/**
 * The one public page that writes to the database.
 *
 * It grants nothing. It records a message and emails us, and a designer
 * decides. Nobody gets in from here, which is why it is safe to have in
 * public at all.
 *
 * The answer is the same whatever happened, including when the address
 * already has an account and when the same address asked ten minutes ago.
 * Otherwise this form would be a way to find out who our clients are.
 */
export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; problem?: string }>
}) {
  const { sent, problem } = await searchParams

  const message =
    problem === 'failed'
      ? 'Something went wrong sending that. Try again in a moment, or just email info@dominatehomes.com.'
      : (problem ?? null)

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="hairline rounded-lg border bg-page p-7">
        <Logomark className="w-11 text-ink" title="Dominate Homes" />
        <p className="mt-4 text-xs tracking-widest text-driftwood uppercase">Dominate Homes</p>
        <h1 className="font-display mt-1 text-2xl leading-tight text-ink">Ask for access</h1>

        {sent ? (
          <div className="mt-5 rounded-md bg-seaglass-wash p-4">
            <p className="text-[15px] leading-relaxed text-driftwood-deep">
              Thank you, that has come through to us. Davina reads these herself, so give her a day
              or so. If it turns out to be a fit she will set up your portal and email you a link.
            </p>
            <p className="mt-3 text-sm text-driftwood">
              Already have a portal?{' '}
              <Link href="/signin" className="text-ink underline underline-offset-2">
                Sign in instead
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            {message ? (
              <p className="mt-4 rounded-md bg-clay-wash p-3 text-sm leading-relaxed text-driftwood-deep">
                {message}
              </p>
            ) : (
              <p className="mt-3 text-[15px] leading-relaxed text-driftwood-deep">
                The portal is for projects we are working on, so it is not something you can sign
                yourself up for. Tell us about the house and we will come back to you.
              </p>
            )}

            <RequestForm />

            <p className="mt-5 text-sm leading-relaxed text-driftwood">
              Already have a portal?{' '}
              <Link href="/signin" className="text-ink underline underline-offset-2">
                Sign in
              </Link>
              .
            </p>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-driftwood">
        We only use what you put here to get back to you about the project.
      </p>
    </div>
  )
}
