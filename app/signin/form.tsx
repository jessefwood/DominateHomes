'use client'

import { useState, useTransition } from 'react'
import { requestLink } from './actions'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = email.trim()
    if (!value) {
      setError('Put your email address in first.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await requestLink(value)
      if (result.error) setError(result.error)
      else setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="mt-5 rounded-md bg-seaglass-wash p-4">
        <p className="text-sm leading-relaxed text-driftwood-deep">
          If that address is on this project, a link is on its way to it. It works once and it runs out in
          20 minutes.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setEmail('')
          }}
          className="mt-3 text-sm text-seaglass-deep underline underline-offset-2"
        >
          Use a different address
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label htmlFor="email" className="text-sm text-driftwood-deep">
        Your email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="hairline mt-1.5 w-full rounded-md border bg-white px-3 py-2.5 text-ink placeholder:text-driftwood focus:border-seaglass focus:outline-none"
        placeholder="you@example.com"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-md bg-ink px-4 py-2.5 text-oyster transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Sending' : 'Send me a link'}
      </button>

      {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
    </form>
  )
}
