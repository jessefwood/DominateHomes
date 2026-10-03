'use client'

import { useState } from 'react'
import { submitRequest } from './actions'

/**
 * A plain form with a server action on it, so it works before React has
 * hydrated and works with JavaScript switched off. The only thing the client
 * component adds is the disabled state on the button, which is there to stop
 * a double submit rather than to make anything work.
 */
export function RequestForm() {
  const [sending, setSending] = useState(false)

  return (
    <form action={submitRequest} onSubmit={() => setSending(true)} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">Your name</span>
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2.5 text-[15px] text-ink"
        />
      </label>

      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">Email</span>
        <input
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2.5 text-[15px] text-ink"
        />
      </label>

      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">
          Phone, if you would rather we called
        </span>
        <input
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2.5 text-[15px] text-ink"
        />
      </label>

      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">
          A bit about the house
        </span>
        <textarea
          name="note"
          rows={4}
          maxLength={2000}
          placeholder="Where it is, who is building it, and roughly when you close."
          className="hairline mt-1.5 w-full resize-y rounded-md border bg-page px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-driftwood/70"
        />
      </label>

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-md bg-ink px-4 py-2.5 text-[15px] text-page transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {sending ? 'Sending' : 'Ask for access'}
      </button>
    </form>
  )
}
