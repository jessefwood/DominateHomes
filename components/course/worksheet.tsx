'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { saveAnswerAction, turnInAction } from '@/app/learn/(course)/[course]/actions'
import { runAction } from '@/lib/client-action'
import { fillSentence, type Field } from '@/lib/course-content'

/**
 * The homework, filled in on the page.
 *
 * This is the whole reason the course moved here: the old form could not be
 * saved, so agents copied their answers out and emailed them. Every answer
 * saves by itself a moment after they stop typing, and again when they leave
 * the box, so there is no save button to forget. The line at the top always
 * says whether what is on screen has reached us.
 */

type Status = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 700

const input =
  'hairline mt-2 w-full rounded-lg border bg-page px-3.5 py-2.5 text-[15px] text-ink placeholder:text-driftwood/70 focus:border-seaglass-deep focus:outline-none'

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
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [problem, setProblem] = useState<string | null>(null)
  const [turnedInAt, setTurnedInAt] = useState(initialTurnedIn)
  const [turning, startTurning] = useTransition()

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const unsaved = useRef(new Map<string, unknown>())
  const inFlight = useRef(0)

  const send = useCallback(
    async (key: string) => {
      if (!unsaved.current.has(key)) return
      const value = unsaved.current.get(key)
      unsaved.current.delete(key)

      inFlight.current += 1
      setStatus('saving')
      const result = await runAction(() => saveAnswerAction(courseSlug, moduleKey, key, value))
      inFlight.current -= 1

      if (result.error) {
        // Put it back so the next keystroke, or leaving the box, tries again.
        if (!unsaved.current.has(key)) unsaved.current.set(key, value)
        setProblem(result.error)
        setStatus('error')
        return
      }

      if (inFlight.current === 0 && unsaved.current.size === 0) {
        setProblem(null)
        setStatus('saved')
      }
    },
    [courseSlug, moduleKey],
  )

  const change = useCallback(
    (key: string, value: unknown) => {
      setValues((was) => ({ ...was, [key]: value }))
      unsaved.current.set(key, value)
      setStatus('saving')

      const existing = timers.current.get(key)
      if (existing) clearTimeout(existing)
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key)
          void send(key)
        }, SAVE_DELAY_MS),
      )
    },
    [send],
  )

  /** Leaving a box saves it straight away rather than waiting out the delay. */
  const flush = useCallback(
    (key: string) => {
      const existing = timers.current.get(key)
      if (existing) {
        clearTimeout(existing)
        timers.current.delete(key)
      }
      void send(key)
    },
    [send],
  )

  // Closing the tab mid-sentence would lose the last few words, so ask first.
  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (unsaved.current.size > 0 || inFlight.current > 0) event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  const text = (key: string) => (typeof values[key] === 'string' ? (values[key] as string) : '')

  return (
    <div className="space-y-8">
      <div
        aria-live="polite"
        className="hairline sticky top-16 z-30 -mx-1 flex items-center justify-between gap-3 rounded-lg border bg-page/95 px-4 py-2.5 text-sm backdrop-blur-sm print:hidden"
      >
        <span className="text-driftwood-deep">Your answers save as you type.</span>
        <span
          className={
            status === 'error'
              ? 'font-medium text-clay-deep'
              : status === 'saving'
                ? 'text-driftwood'
                : 'text-seaglass-deep'
          }
        >
          {status === 'saving'
            ? 'Saving'
            : status === 'error'
              ? 'Not saved yet'
              : status === 'saved'
                ? 'Saved'
                : 'Up to date'}
        </span>
      </div>

      {problem ? (
        <p className="rounded-lg bg-clay-wash px-4 py-3 text-sm leading-relaxed text-clay-deep">
          {problem} What you typed is still on the page, and it will try again when you keep going.
        </p>
      ) : null}

      <ol className="space-y-8">
        {fields.map((field, index) => {
          const number = index + 1
          return (
            <li key={field.key} className="space-y-1">
              <Label field={field} number={number} />

              {field.kind === 'text' || field.kind === 'number' ? (
                <input
                  type="text"
                  inputMode={field.kind === 'number' ? 'decimal' : undefined}
                  value={text(field.key)}
                  onChange={(event) => change(field.key, event.target.value)}
                  onBlur={() => flush(field.key)}
                  className={input}
                />
              ) : null}

              {field.kind === 'long' ? (
                <textarea
                  rows={4}
                  value={text(field.key)}
                  onChange={(event) => change(field.key, event.target.value)}
                  onBlur={() => flush(field.key)}
                  className={`${input} resize-y leading-relaxed`}
                />
              ) : null}

              {field.kind === 'choice' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {field.options.map((option) => {
                    const picked = values[field.key] === option
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => {
                          change(field.key, picked ? '' : option)
                          flush(field.key)
                        }}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          picked
                            ? 'border-seaglass-deep bg-seaglass-deep text-page'
                            : 'hairline bg-page text-driftwood-deep hover:bg-oyster'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {field.kind === 'checks' ? (
                <div className="mt-2 space-y-2">
                  {field.options.map((option) => {
                    const ticked = Array.isArray(values[field.key])
                      ? (values[field.key] as string[]).includes(option)
                      : false
                    return (
                      <label
                        key={option}
                        className="hairline flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] text-ink hover:bg-oyster/60"
                      >
                        <input
                          type="checkbox"
                          checked={ticked}
                          onChange={() => {
                            const was = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []
                            change(
                              field.key,
                              ticked ? was.filter((item) => item !== option) : [...was, option],
                            )
                            flush(field.key)
                          }}
                          className="mt-1 size-4 accent-[var(--color-seaglass-deep)]"
                        />
                        <span>{option}</span>
                      </label>
                    )
                  })}
                </div>
              ) : null}

              {field.kind === 'sentence' ? (
                <div className="mt-2 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field.parts.map((part) => {
                      const current = (values[field.key] as Record<string, string> | undefined) ?? {}
                      return (
                        <label key={part.key} className="block">
                          <span className="text-xs tracking-widest text-driftwood uppercase">{part.label}</span>
                          <input
                            type="text"
                            value={current[part.key] ?? ''}
                            onChange={(event) => change(field.key, { ...current, [part.key]: event.target.value })}
                            onBlur={() => flush(field.key)}
                            className={input}
                          />
                        </label>
                      )
                    })}
                  </div>
                  <p className="rounded-lg bg-seaglass-wash px-4 py-3 font-display text-lg leading-snug text-ink">
                    {fillSentence(field, values[field.key] as Record<string, string> | undefined)}
                  </p>
                </div>
              ) : null}

              {field.kind === 'signature' ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={(values[field.key] as { name?: string } | undefined)?.name ?? ''}
                    onChange={(event) =>
                      change(field.key, { name: event.target.value, signedAt: new Date().toISOString() })
                    }
                    onBlur={() => flush(field.key)}
                    placeholder="Your full name"
                    className={`${input} font-display text-xl`}
                  />
                </div>
              ) : null}
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
                  for (const key of [...unsaved.current.keys()]) flush(key)
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
