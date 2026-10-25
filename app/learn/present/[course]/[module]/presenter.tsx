'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { Logomark } from '@/components/logo'
import { runAction } from '@/lib/client-action'
import { stepTitle, type Step } from '@/lib/course-content'
import { endLiveAction, presentStepAction } from '@/app/learn/present/actions'

/**
 * Teaching a module.
 *
 * The arrow keys (or space) move the slide. Two separate ideas of "moving":
 *
 *   Locally, always. A second window opened with "Open the shared screen"
 *   follows this one through a BroadcastChannel, which never leaves the
 *   browser. That is the window to share in Zoom, so the notes stay private.
 *
 *   For the class, only while live. Going live writes the slide to the
 *   server on every move, and every agent's own page follows it. Rehearsing
 *   on a Sunday night therefore moves nobody.
 */

type Props = {
  courseSlug: string
  courseTitle: string
  moduleKey: string
  moduleNumber: number
  moduleTitle: string
  goal: string
  steps: Step[]
  screenOnly: boolean
  liveHere: boolean
  startAt: number
}

function Slide({ step, moduleNumber, index, steps }: { step: Step; moduleNumber: number; index: number; steps: Step[] }) {
  const hasOpening = steps[0]?.kind === 'lesson' && steps[0].isOpening
  return (
    <div className="mx-auto w-full max-w-5xl">
      {step.kind === 'lesson' ? (
        <>
          <p className="eyebrow text-sm">
            Module {moduleNumber} · {step.isOpening ? 'Before we start' : `Lesson ${index + (hasOpening ? 0 : 1)}`}
          </p>
          <h1 className="font-display mt-3 mb-10 text-5xl leading-tight text-ink sm:text-6xl">{step.lesson.title}</h1>
          <LessonBlocks blocks={step.lesson.blocks} size="present" />
        </>
      ) : (
        <>
          <p className="eyebrow text-sm">Module {moduleNumber} · Homework</p>
          <h1 className="font-display mt-3 mb-4 text-5xl leading-tight text-ink sm:text-6xl">{step.worksheet.title}</h1>
          <p className="mb-10 text-2xl leading-relaxed text-driftwood-deep">
            Open it on your own screen under this module. It saves as you type, so nothing to copy or send.
          </p>
          <ol className="list-decimal space-y-3 pl-8 text-2xl leading-snug text-ink marker:text-seaglass-deep">
            {step.worksheet.fields.map((field) => (
              <li key={field.key} className="pl-1">
                {field.label}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

export function Presenter(props: Props) {
  const { courseSlug, moduleKey, steps, screenOnly } = props
  const last = steps.length - 1

  const [index, setIndex] = useState(Math.min(props.startAt, last))
  const [live, setLive] = useState(props.liveHere)
  const [notes, setNotes] = useState(true)
  const [problem, setProblem] = useState<string | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)

  // One channel per module, shared by the presenter and the shared screen.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const named = new BroadcastChannel(`present:${courseSlug}:${moduleKey}`)
    channel.current = named
    named.onmessage = (event: MessageEvent<{ step?: number; hello?: true }>) => {
      if (screenOnly && typeof event.data.step === 'number') setIndex(event.data.step)
    }
    // A shared screen opened late asks where we are.
    if (screenOnly) named.postMessage({ hello: true })
    return () => named.close()
  }, [courseSlug, moduleKey, screenOnly])

  // The presenter answers a late shared screen's hello.
  useEffect(() => {
    const named = channel.current
    if (!named || screenOnly) return
    const reply = (event: MessageEvent<{ hello?: true }>) => {
      if (event.data.hello) named.postMessage({ step: index })
    }
    named.addEventListener('message', reply)
    return () => named.removeEventListener('message', reply)
  }, [index, screenOnly])

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(last, to))
      setIndex(next)
      channel.current?.postMessage({ step: next })
      if (live) {
        void runAction(() => presentStepAction(courseSlug, moduleKey, next)).then((result) =>
          setProblem(result.error ?? null),
        )
      }
    },
    [courseSlug, moduleKey, last, live],
  )

  useEffect(() => {
    if (screenOnly) return
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault()
        go(index + 1)
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        go(index - 1)
      } else if (event.key === 'n' || event.key === 'N') {
        setNotes((was) => !was)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, screenOnly])

  async function toggleLive() {
    if (live) {
      const result = await runAction(() => endLiveAction(courseSlug))
      if (result.error) return setProblem(result.error)
      setLive(false)
    } else {
      const result = await runAction(() => presentStepAction(courseSlug, moduleKey, index))
      if (result.error) return setProblem(result.error)
      setLive(true)
    }
    setProblem(null)
  }

  const step = steps[index]
  const nextStep = steps[index + 1]

  if (screenOnly) {
    return (
      <div className="flex min-h-screen flex-col bg-page px-10 py-12 sm:px-16">
        <div className="flex items-center gap-3 text-driftwood">
          <Logomark className="w-8 text-ink" title="Dominate Homes" />
          <span className="text-sm tracking-[0.18em] uppercase">{props.courseTitle}</span>
        </div>
        <div className="flex flex-1 items-center py-10">
          <Slide step={step} moduleNumber={props.moduleNumber} index={index} steps={steps} />
        </div>
        <div className="h-1 w-full rounded-full bg-oyster">
          <div className="h-1 rounded-full bg-seaglass-deep" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-oyster">
      <header className="hairline flex flex-wrap items-center gap-3 border-b bg-page px-4 py-3 sm:px-6">
        <Link href={`/learn/${courseSlug}/${moduleKey}`} className="text-sm text-driftwood hover:text-ink">
          ← Leave
        </Link>
        <span className="text-sm text-ink">
          Module {props.moduleNumber}, {props.moduleTitle}
        </span>
        <span className="text-sm text-driftwood">
          {index + 1} of {steps.length}
        </span>
        <span className="flex-1" />

        <button
          type="button"
          onClick={() =>
            window.open(`/learn/present/${courseSlug}/${moduleKey}?view=screen`, `screen-${moduleKey}`, 'width=1280,height=800')
          }
          className="hairline rounded-md border bg-page px-3 py-1.5 text-sm text-ink hover:bg-oyster"
        >
          Open the shared screen
        </button>

        <button
          type="button"
          onClick={() => setNotes((was) => !was)}
          className="hairline rounded-md border bg-page px-3 py-1.5 text-sm text-ink hover:bg-oyster"
        >
          {notes ? 'Hide notes' : 'Show notes'}
        </button>

        <button
          type="button"
          onClick={() => void toggleLive()}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${
            live ? 'bg-seaglass-deep text-page' : 'bg-ink text-page hover:opacity-90'
          }`}
        >
          {live ? 'Live: agents are following. End' : 'Go live'}
        </button>
      </header>

      {problem ? <p className="bg-clay-wash px-6 py-2 text-sm text-clay-deep">{problem}</p> : null}

      <div className={`grid flex-1 gap-0 ${notes ? 'lg:grid-cols-[1fr_22rem]' : ''}`}>
        <main className="flex items-center bg-page px-8 py-12 sm:px-14">
          <Slide step={step} moduleNumber={props.moduleNumber} index={index} steps={steps} />
        </main>

        {notes ? (
          <aside className="hairline space-y-6 border-t bg-oyster px-6 py-6 lg:border-t-0 lg:border-l">
            <div>
              <p className="eyebrow">This module</p>
              <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">{props.goal}</p>
            </div>

            {step.kind === 'lesson' && step.lesson.notes ? (
              <div>
                <p className="eyebrow">Your notes</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{step.lesson.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="eyebrow">Next</p>
              <p className="mt-1 text-[15px] text-ink">{nextStep ? stepTitle(nextStep) : 'That is the end of this module.'}</p>
            </div>

            <ol className="space-y-1 text-sm">
              {steps.map((each, number) => (
                <li key={number}>
                  <button
                    type="button"
                    onClick={() => go(number)}
                    className={`w-full rounded-md px-2.5 py-1.5 text-left ${
                      number === index ? 'bg-page font-medium text-ink shadow-sheet' : 'text-driftwood-deep hover:bg-page/70'
                    }`}
                  >
                    {number + 1}. {stepTitle(each)}
                  </button>
                </li>
              ))}
            </ol>

            <p className="text-xs leading-relaxed text-driftwood">
              Arrow keys or space to move. N hides these notes. Share the shared screen window in Zoom so the class
              never sees this panel.
            </p>
          </aside>
        ) : null}
      </div>

      <footer className="hairline flex items-center justify-between border-t bg-page px-6 py-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className="hairline rounded-md border px-4 py-2 text-sm text-ink hover:bg-oyster disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={index === last}
          onClick={() => go(index + 1)}
          className="rounded-md bg-ink px-5 py-2 text-sm text-page hover:opacity-90 disabled:opacity-40"
        >
          Next →
        </button>
      </footer>
    </div>
  )
}
