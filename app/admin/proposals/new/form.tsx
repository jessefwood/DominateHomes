'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ProposalTier } from '@prisma/client'
import { runAction } from '@/lib/client-action'
import { createProposalDraft } from '../actions'

type ProjectOption = { id: string; displayName: string; clientName: string }

const FIELD =
  'hairline mt-1.5 w-full rounded border bg-white px-3 py-2 text-sm text-ink'

/**
 * The draft form.
 *
 * Only asks for what cannot be derived. The rates and the expense labels are
 * pre-filled from the invoice this business already sends, so the common case
 * is reading them rather than typing them, and every one is still editable
 * because a second project will not have the same numbers.
 */
export function NewProposalForm({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await runAction(() => createProposalDraft(form))
      if (result.error) setError(result.error)
      else router.push('/admin/proposals')
    })
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div>
        <label htmlFor="projectId" className="text-sm text-ink">
          Project
        </label>
        <select id="projectId" name="projectId" className={FIELD} defaultValue={projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.displayName} · {project.clientName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tier" className="text-sm text-ink">
          Level
        </label>
        <select id="tier" name="tier" className={FIELD} defaultValue={ProposalTier.RECOMMENDED}>
          <option value={ProposalTier.LEAN}>Lean · the low band on every room</option>
          <option value={ProposalTier.RECOMMENDED}>Recommended · the middle band</option>
          <option value={ProposalTier.ELEVATED}>Elevated · the high band</option>
        </select>
        <p className="mt-1.5 text-sm text-driftwood">
          This picks which of the three bands on each room the document prices. Nothing here is a
          quote until it is priced against a live product.
        </p>
      </div>

      <div>
        <label htmlFor="preparedForLabel" className="text-sm text-ink">
          Addressed to
        </label>
        <input
          id="preparedForLabel"
          name="preparedForLabel"
          className={FIELD}
          placeholder="Abbie and Russell"
        />
      </div>

      <div>
        <label htmlFor="intro" className="text-sm text-ink">
          Opening paragraph
        </label>
        <textarea
          id="intro"
          name="intro"
          rows={4}
          className={FIELD}
          placeholder="Everything below comes out of our 14 September conversation: modern coastal blended with traditional New England, your Colorado pieces worked in throughout, install after your 1 April closing. Furnishing figures are careful estimates, not fixed prices. You are invoiced actual cost."
        />
        <p className="mt-1.5 text-sm text-driftwood">
          The part she reads first. Speak to her directly, and no em dashes.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm text-ink">Rates</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="taxRate" className="text-xs text-driftwood uppercase tracking-wide">
              Sales tax %
            </label>
            <input id="taxRate" name="taxRate" defaultValue="7.0" className={FIELD} />
          </div>
          <div>
            <label htmlFor="freightRate" className="text-xs text-driftwood uppercase tracking-wide">
              Freight %
            </label>
            <input id="freightRate" name="freightRate" defaultValue="8.0" className={FIELD} />
          </div>
          <div>
            <label
              htmlFor="designFeeRate"
              className="text-xs text-driftwood uppercase tracking-wide"
            >
              Design fee %
            </label>
            <input id="designFeeRate" name="designFeeRate" defaultValue="30" className={FIELD} />
          </div>
        </div>
        <p className="mt-1.5 text-sm text-driftwood">
          Florida is 6% state plus the county surtax, so check the county rate rather than trusting
          the 7% default. Freight is an allowance on goods. The design fee is a percentage of the
          furnishings subtotal and lands on the expense side, never the furnishing side.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-sm text-ink">Your expenses, beyond the fee</legend>
        <p className="mt-1 text-sm text-driftwood">
          These are yours to set and nothing can guess them. Leave a label blank to drop the row.
        </p>
        {[
          { label: 'Install labor', detail: 'Five days on site placing, assembling, hanging and styling the house' },
          { label: 'Travel and receiving', detail: 'Air for two, rental car, fuel and meals during the install week, plus taking delivery and staging' },
          { label: 'Lodging', detail: 'Waived. You have offered us the house during the install week.' },
          { label: '', detail: '' },
        ].map((row, index) => (
          <div key={index} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_7rem]">
            <input
              name={`expenseLabel${index}`}
              defaultValue={row.label}
              placeholder="What it is"
              className={FIELD}
            />
            <input
              name={`expenseDetail${index}`}
              defaultValue={row.detail}
              placeholder="What it covers"
              className={FIELD}
            />
            <input
              name={`expenseAmount${index}`}
              placeholder="$0"
              inputMode="decimal"
              className={FIELD}
            />
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-sm text-ink">Payment schedule</legend>
        <p className="mt-1 text-sm text-driftwood">
          Has to add up to goods delivered plus fee and expenses, and the draft is refused if it
          does not. Leave it all blank and you get one instalment for the whole amount to edit
          later.
        </p>
        {['On acceptance', 'January 2027', 'March 2027', 'At completion'].map((when, index) => (
          <div key={index} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_7rem]">
            <input
              name={`paymentWhen${index}`}
              defaultValue={when}
              placeholder="When"
              className={FIELD}
            />
            <input
              name={`paymentDetail${index}`}
              placeholder="What it covers"
              className={FIELD}
            />
            <input
              name={`paymentAmount${index}`}
              placeholder="$0"
              inputMode="decimal"
              className={FIELD}
            />
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-sm text-ink">Scope</legend>
        <p className="mt-1 text-sm text-driftwood">One per line.</p>
        {(
          [
            ['scopeINCLUDED', 'Included'],
            ['scopeNOT_INCLUDED', 'Not included'],
            ['scopeCLIENT_OWNED', 'What she already owns, worked in at no cost'],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="mt-3">
            <label htmlFor={name} className="text-xs tracking-wide text-driftwood uppercase">
              {label}
            </label>
            <textarea id={name} name={name} rows={4} className={FIELD} />
          </div>
        ))}
      </fieldset>

      {error ? <p className="text-sm text-clay-deep">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-5 py-2.5 text-sm text-oyster disabled:opacity-60"
      >
        {pending ? 'Drafting' : 'Draft it'}
      </button>
      <p className="text-sm text-driftwood">
        This only drafts. Nothing reaches the client until you read it through and send it.
      </p>
    </form>
  )
}
