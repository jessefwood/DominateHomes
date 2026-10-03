'use client'

import { useState, useTransition } from 'react'
import { runAction } from '@/lib/client-action'
import { formatCents } from '@/lib/money'
import { PROPOSAL_STATEMENT } from '@/lib/proposal-statement'
import { acceptProposalAction, declineProposalAction } from './actions'

/**
 * Acceptance. The statement sits above the signature, not in a footer, because
 * that is the moment it matters, and the exact text shown here is what gets
 * stored on the record.
 *
 * "Ask for a change" is as prominent as accepting on purpose. A proposal she
 * feels cornered by is worse for everyone than one she pushes back on.
 */
export function AcceptProposal({
  proposalId,
  projectSlug,
  payableNowCents,
  payableNowLabel,
}: {
  proposalId: string
  projectSlug: string
  payableNowCents: number | null
  payableNowLabel: string | null
}) {
  const [name, setName] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function accept(event: React.FormEvent) {
    event.preventDefault()
    if (!understood) {
      setError('Tick the box to confirm you have read what you are accepting.')
      return
    }
    if (name.trim().length < 2) {
      setError('Type your name as you would sign it.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await runAction(() => acceptProposalAction(proposalId, name, projectSlug))
      if (result.error) setError(result.error)
    })
  }

  function decline(event: React.FormEvent) {
    event.preventDefault()
    if (note.trim().length < 3) {
      setError('Say what you would like changed, even roughly.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await runAction(() => declineProposalAction(proposalId, note, projectSlug))
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="hairline mt-8 rounded-lg border bg-white p-6">
      <h2 className="font-display text-xl text-ink">Accepting this</h2>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-driftwood-deep">
        {PROPOSAL_STATEMENT}
      </p>

      {payableNowCents !== null && payableNowLabel ? (
        <p className="mt-4 rounded-md bg-sand/60 px-4 py-3 text-sm text-ink">
          {payableNowLabel} is {formatCents(payableNowCents)}. Accepting does not charge you.
          Davina will send that invoice separately.
        </p>
      ) : null}

      {asking ? (
        <form onSubmit={decline} className="mt-5">
          <label htmlFor="note" className="block text-sm text-ink">
            What would you like changed?
          </label>
          <textarea
            id="note"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="hairline mt-1.5 w-full rounded border bg-white px-3 py-2 text-sm text-ink"
            placeholder="A different level, a room taken out, the payment timing. Anything."
          />

          {error ? <p className="mt-2 text-sm text-clay-deep">{error}</p> : null}

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-ink px-4 py-2 text-sm text-oyster disabled:opacity-60"
            >
              {pending ? 'Sending' : 'Send this to Davina'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false)
                setError(null)
              }}
              className="text-sm text-driftwood hover:text-ink"
            >
              Back
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={accept} className="mt-5">
          <label className="flex items-start gap-2.5 text-sm leading-relaxed text-driftwood-deep">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-0.5"
            />
            <span>I have read the above and the scope on this page.</span>
          </label>

          <label htmlFor="signature" className="mt-4 block text-sm text-ink">
            Type your name to sign
          </label>
          <input
            id="signature"
            name="signature"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="hairline mt-1.5 w-full max-w-sm rounded border bg-white px-3 py-2 text-ink"
          />

          {error ? <p className="mt-2 text-sm text-clay-deep">{error}</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-ink px-5 py-2.5 text-sm text-oyster disabled:opacity-60"
            >
              {pending ? 'Signing' : 'Accept this proposal'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(true)
                setError(null)
              }}
              className="text-sm text-driftwood underline underline-offset-2 hover:text-ink"
            >
              Ask for a change instead
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
