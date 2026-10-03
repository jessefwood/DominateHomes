'use client'

import { runAction } from '@/lib/client-action'

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
  photoUrl: string | null
  productUrl: string | null
}

/**
 * The picker. Always exactly three columns, because the data model has exactly
 * three slots. An empty slot stays visible rather than collapsing, so every
 * item presents the same shape of decision: at most three things to weigh,
 * never a wall of choices.
 */
export function OptionPicker({
  selectionId,
  projectSlug,
  roomSlug,
  options,
  chosenSlot,
  locked,
}: {
  selectionId: string
  projectSlug: string
  roomSlug: string
  options: PickableOption[]
  chosenSlot: Slot | null
  locked: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(slot: Slot) {
    setError(null)
    startTransition(async () => {
      const result = await runAction(() => pickOption(selectionId, slot, projectSlug, roomSlug))
      if (result.error) setError(result.error)
    })
  }

  function clear() {
    setError(null)
    startTransition(async () => {
      const result = await runAction(() => unpickOption(selectionId, projectSlug, roomSlug))
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
                className="hairline rounded-md border border-dashed bg-oyster/60 p-3 text-sm text-driftwood"
              >
                <div className="hairline mb-3 flex aspect-[4/3] items-center justify-center rounded-md border border-dashed">
                  <span className="text-xs text-driftwood">Still to come</span>
                </div>
                <p className="text-xs tracking-widest text-driftwood uppercase">Option {slot}</p>
                <p className="mt-2 leading-relaxed">Davina is still putting this one together.</p>
              </div>
            )
          }

          return (
            <div
              key={slot}
              className={`flex flex-col rounded-md border p-3 text-sm ${
                chosen ? 'border-seaglass bg-seaglass-wash' : 'hairline border bg-page'
              }`}
            >
              {option.photoUrl ? (
                <div className="photo-frame mb-3 aspect-[4/3] rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={option.photoUrl}
                    alt={option.label}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="hairline mb-3 flex aspect-[4/3] items-center justify-center rounded-md border border-dashed bg-oyster/60">
                  <span className="text-xs text-driftwood">No photo yet</span>
                </div>
              )}

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
              {option.productUrl ? (
                <a
                  href={option.productUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 text-driftwood underline underline-offset-2 transition-colors hover:text-ink"
                >
                  See it at {option.vendor}
                </a>
              ) : null}
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
                    className="w-full rounded-md bg-ink px-3 py-1.5 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
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
