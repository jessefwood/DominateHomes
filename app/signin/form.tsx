'use client'

import { useFormStatus } from 'react-dom'
import { requestLink } from './actions'

/**
 * A plain form with a server action. No client state: the outcome comes back
 * in the query string, so it survives the full page reload that a submit
 * without JavaScript causes. See the note in actions.ts.
 */

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-md bg-ink px-4 py-2.5 text-oyster transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Sending' : 'Send me a link'}
    </button>
  )
}

export function SignInForm({ defaultEmail }: { defaultEmail?: string }) {
  return (
    <form action={requestLink} className="mt-5">
      <label htmlFor="email" className="text-sm text-driftwood-deep">
        Your email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        className="hairline mt-1.5 w-full rounded-md border bg-white px-3 py-2.5 text-ink placeholder:text-driftwood focus:border-seaglass focus:outline-none"
        placeholder="you@example.com"
      />

      <SubmitButton />
    </form>
  )
}
