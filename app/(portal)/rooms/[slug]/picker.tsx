'use client'

import { useState, useTransition } from 'react'
import { Pill } from '@/components/ui'
import { formatCents } from '@/lib/money'
import { pickOption, unpickOption } from './actions'

/**
 * The three slots, in order. There is no fourth, by design. Declared here
 * rather than imported from the Prisma client, because this is a browser
 * component and importing the Prisma runtime drags the Postgres driver into
 * the bundle.
 */
const SLOTS = ['A', 'B', 'C'] as const
type Slot = (typeof SLOTS)[number]

/** Only the fields the picker renders. Plain data, safe to send to a browser. */
export type PickableOption = {
  slot: Slot
  label: string
  vendor: string
  priceCents: number
  leadTimeDays: number | null
  dimensions: string | null
  nonReturnable: boolean
}

/**
 * The picker. Always exactly three columns, because the data model has exactly
 * three slots. An empty slot stays visible rather than collapsing, so every
 * item presents the same shape of decision: at most three things to weigh,
 * never a wall of choices.
 */
export function OptionPicker({
  selectionId,
  slug,
  options,
  chosenSlot,
  locked,
}: {
  selectionId: string
  slug: string
  options: PickableOption[]
  chosenSlot: Slot | null
  locked: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(slot: Slot) {
    setError(null)
    startTransition(async () => {
      const result = await pickOption(selectionId, slot, slug)
      if (result.error) setError(result.error)
    })
  }

  function clear() {
    setError(null)
    startTransition(async () => {
      const result = await unpickOption(selectionId, slug)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="mt-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {SLOTS.map((slot) => {
          const option = options.find((candidate) => candidate.slot === slot)
          const chosen = chosenSlot === slot

          if (!option) {
            return (
              <div
                key={slot}
                className="hairline rounded-md border border-dashed bg-oyster-deep/40 p-3 text-sm text-driftwood"
              >
                <p className="text-xs tracking-widest text-driftwood uppercase">Option {slot}</p>
                <p className="mt-2 leading-relaxed">Davina is still putting this one together.</p>
              </div>
            )
          }

          return (
            <div
              key={slot}
              className={`flex flex-col rounded-md border p-3 text-sm ${
                chosen ? 'border-seaglass bg-seaglass-wash' : 'hairline border bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-widest text-driftwood uppercase">Option {slot}</p>
                {chosen ? <Pill tone="sea">Your pick</Pill> : null}
              </div>

              <p className="mt-2 leading-snug font-medium text-ink">{option.label}</p>
              <p className="mt-1 text-driftwood">{option.vendor}</p>
              <p className="mt-2 text-ink">{formatCents(option.priceCents)}</p>
              {option.leadTimeDays ? (
                <p className="mt-1 text-driftwood">About {option.leadTimeDays} days to arrive</p>
              ) : null}
              {option.dimensions ? <p className="mt-1 text-driftwood">{option.dimensions}</p> : null}
              {option.nonReturnable ? (
                <p className="mt-2 text-xs leading-relaxed text-clay-deep">
                  Made to order, so it cannot be returned once the vendor confirms it.
                </p>
              ) : null}

              <div className="mt-3 pt-1">
                {locked ? null : chosen ? (
                  <button
                    type="button"
                    onClick={clear}
                    disabled={pending}
                    className="text-sm text-seaglass-deep underline underline-offset-2 disabled:opacity-50"
                  >
                    Change my mind
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => choose(slot)}
                    disabled={pending}
                    className="w-full rounded-md bg-ink px-3 py-1.5 text-sm text-oyster transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? 'Saving' : 'Pick this one'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {locked ? (
        <p className="mt-2 text-xs leading-relaxed text-driftwood">
          This one is signed off, so it is fixed now. Ask Davina if something needs to change.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-clay-deep">{error}</p> : null}
    </div>
  )
}
