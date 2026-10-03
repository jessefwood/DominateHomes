'use client'

import { useState, useTransition } from 'react'
import { APPROVAL_STATEMENT } from '@/lib/approval-statement'
import { formatCents } from '@/lib/money'
import { approveRoom } from './actions'

/**
 * Sign-off for a whole room. Rooms are approved as a whole so the pieces are
 * signed against each other rather than one at a time.
 *
 * The non-returnable warning sits above the signature, not in a footer, because
 * that is the moment it matters. The exact statement shown is stored on the
 * approval record, so what she agreed to is recoverable years later.
 */
export function ApproveRoom({
  roomId,
  roomName,
  projectSlug,
  roomSlug,
  totalCents,
  nonReturnableItems,
}: {
  roomId: string
  roomName: string
  projectSlug: string
  roomSlug: string
  totalCents: number
  nonReturnableItems: string[]
}) {
  const [name, setName] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!understood) {
      setError('Tick the box to confirm you have read what approving means.')
      return
    }
    if (name.trim().length < 2) {
      setError('Type your name as your signature.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await approveRoom(roomId, name, projectSlug, roomSlug)
      if (result.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={submit} className="hairline rounded-lg border bg-white p-5">
      <h2 className="font-display text-xl text-ink">Sign off {roomName}</h2>

      <p className="mt-2 text-sm leading-relaxed text-driftwood-deep">
        Everything in this room has a pick, so it is ready to approve. Approving freezes the prices
        exactly as they are today, which is what Davina orders against.
      </p>

      <p className="mt-3 text-lg text-ink">{formatCents(totalCents)}</p>
      <p className="text-sm text-driftwood">Furnishings in this room, at today&rsquo;s prices</p>

      {nonReturnableItems.length > 0 ? (
        <div className="mt-4 rounded-md border border-clay/30 bg-clay-wash p-3">
          <p className="text-sm font-medium text-clay-deep">
            {nonReturnableItems.length === 1 ? 'One item here cannot' : 'Some items here cannot'} be
            returned
          </p>
          <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">
            {nonReturnableItems.join(', ')}. {nonReturnableItems.length === 1 ? 'This is' : 'These are'}{' '}
            made or cut to order, so once the vendor confirms it there is no returning or cancelling.
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-driftwood-deep">{APPROVAL_STATEMENT}</p>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-driftwood-deep">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-seaglass-deep)]"
        />
        <span>I have read the above and I am approving these items for order.</span>
      </label>

      <label htmlFor={`sign-${roomId}`} className="mt-4 block text-sm text-driftwood-deep">
        Type your name to sign
      </label>
      <input
        id={`sign-${roomId}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        className="hairline mt-1.5 w-full max-w-sm rounded-md border bg-white px-3 py-2 text-ink placeholder:text-driftwood focus:border-seaglass focus:outline-none"
        placeholder="Your full name"
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-seaglass-deep px-4 py-2 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Signing' : `Approve ${roomName}`}
        </button>
        {error ? <p className="text-sm text-clay-deep">{error}</p> : null}
      </div>
    </form>
  )
}
