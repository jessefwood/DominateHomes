import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { SignInForm } from './form'

export const dynamic = 'force-dynamic'

const PROBLEM: Record<string, string> = {
  expired: 'That link had run out. They last 20 minutes. Here is a fresh one.',
  used: 'That link had already been used. Links work once, so here is a new one.',
  unknown: 'That link did not work. Ask for a new one and it should be fine.',
  missing: 'That link was incomplete. Ask for a new one.',
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>
}) {
  if (await currentUser()) redirect('/')

  const { problem } = await searchParams
  const message = problem ? PROBLEM[problem] : null

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="hairline rounded-lg border bg-white p-7">
        <p className="text-xs tracking-widest text-driftwood uppercase">Dominate Homes</p>
        <h1 className="font-display mt-1 text-2xl leading-tight text-ink">Plan 643 Bianca PSL</h1>

        {message ? (
          <p className="mt-4 rounded-md bg-clay-wash p-3 text-sm leading-relaxed text-driftwood-deep">
            {message}
          </p>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-driftwood-deep">
            Put in your email and we will send you a link that opens the portal. There is no password to
            remember.
          </p>
        )}

        <SignInForm />
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-driftwood">
        Trouble getting in? Text Davina and she will sort it out.
      </p>
    </div>
  )
}
