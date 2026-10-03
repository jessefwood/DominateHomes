'use client'

import { useState, useTransition } from 'react'
import { ProposalStatus } from '@prisma/client'
import { runAction } from '@/lib/client-action'
import { issueProposal, pullProposal } from './actions'

/**
 * Issue and withdraw. Issuing is the irreversible one, so it asks once: after
 * this the figures are what the client was shown and the only way to change
 * them is a new proposal.
 */
export function ProposalControls({
  proposalId,
  status,
  number,
}: {
  proposalId: string
  status: ProposalStatus
  number: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await runAction(action)
      if (result.error) setError(result.error)
      else setConfirming(false)
    })
  }

  return (
    <div className="mt-3">
      {status === ProposalStatus.DRAFT && !confirming ? (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded bg-ink px-4 py-2 text-sm text-oyster"
          >
            Send it to her
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => pullProposal(proposalId))}
            className="text-sm text-driftwood hover:text-ink"
          >
            Discard
          </button>
        </div>
      ) : null}

      {status === ProposalStatus.DRAFT && confirming ? (
        <div className="rounded-md bg-clay-wash px-4 py-3">
          <p className="text-sm leading-relaxed text-clay-deep">
            Sending {number} freezes every figure on it. If something is wrong you withdraw it and
            issue a new one, and the record of this one stands. Read it through first.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => issueProposal(proposalId))}
              className="rounded bg-ink px-4 py-2 text-sm text-oyster disabled:opacity-60"
            >
              {pending ? 'Sending' : 'Yes, send it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-driftwood hover:text-ink"
            >
              Not yet
            </button>
          </div>
        </div>
      ) : null}

      {status === ProposalStatus.SENT ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => pullProposal(proposalId))}
          className="text-sm text-driftwood hover:text-ink"
        >
          Withdraw it
        </button>
      ) : null}

      {error ? <p className="mt-2 text-sm text-clay-deep">{error}</p> : null}
    </div>
  )
}
