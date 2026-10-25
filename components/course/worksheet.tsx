'use client'

import { useCallback, useState, useTransition } from 'react'
import { saveAnswerAction, turnInAction } from '@/app/learn/(course)/[course]/actions'
import { runAction } from '@/lib/client-action'
import type { Field } from '@/lib/course-content'
import { FieldInput } from './field-input'
import { SaveBar } from './save-bar'
import { useAutosave } from './use-autosave'

/**
 * The homework, filled in on the page.
 *
 * This is the whole reason the course moved here: the old form could not be
 * saved, so agents copied their answers out and emailed them. Every answer
 * saves by itself a moment after they stop typing, and again when they leave
 * the box, so there is no save button to forget. The line at the top always
 * says whether what is on screen has reached us.
 */

function Label({ field, number }: { field: Field; number: number }) {
  return (
    <div>
      <p className="text-[15px] font-medium leading-snug text-ink">
        <span className="mr-2 text-driftwood">{number}.</span>
        {field.label}
      </p>
      {field.help ? <p className="mt-1 text-sm leading-relaxed text-driftwood">{field.help}</p> : null}
    </div>
  )
}

export function Worksheet({
  courseSlug,
  moduleKey,
  fields,
  initial,
  turnedInAt: initialTurnedIn,
  due,
}: {
  courseSlug: string
  moduleKey: string
  fields: Field[]
  initial: Record<string, unknown>
  turnedInAt: string | null
  due: string
}) {
  const save = useCallback(
    (key: string, value: unknown) => saveAnswerAction(courseSlug, moduleKey, key, value),
    [courseSlug, moduleKey],
  )
  const { values, change, flush, flushAll, status, problem, setProblem } = useAutosave(initial, save)
  const [turnedInAt, setTurnedInAt] = useState(initialTurnedIn)
  const [turning, startTurning] = useTransition()

  return (
    <div className="space-y-8">
      <SaveBar status={status} problem={problem} note="Your answers save as you type." />

      <ol className="space-y-8">
        {fields.map((field, index) => {
          const number = index + 1
          return (
            <li key={field.key} className="space-y-1">
              <Label field={field} number={number} />
              <FieldInput
                field={field}
                value={values[field.key]}
                onChange={(next) => change(field.key, next)}
                onCommit={() => flush(field.key)}
              />
            </li>
          )
        })}
      </ol>

      <div className="hairline rounded-xl border bg-oyster/60 p-5 print:hidden">
        {turnedInAt ? (
          <>
            <p className="font-medium text-seaglass-deep">Turned in. Davina can see it.</p>
            <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">
              You can still change any answer and it will save. Davina sees the latest version.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-ink">Done with this week?</p>
            <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">
              Turn it in by {due}. Your answers are already saved; this just tells Davina you are finished.
            </p>
            <button
              type="button"
              disabled={turning}
              onClick={() =>
                startTurning(async () => {
                  // Anything still waiting on the save delay goes first, so
                  // what is turned in is what is on the screen.
                  flushAll()
                  const result = await runAction(() => turnInAction(courseSlug, moduleKey))
                  if (result.error) {
                    setProblem(result.error)
                    return
                  }
                  setTurnedInAt((result as { turnedInAt?: string }).turnedInAt ?? new Date().toISOString())
                })
              }
              className="mt-4 rounded-md bg-ink px-5 py-2.5 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {turning ? 'Turning it in' : 'Turn in my homework'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
