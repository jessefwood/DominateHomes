'use client'

import { statusLabel, type SaveStatus } from './use-autosave'

/**
 * Says whether what is on screen has reached us, and stays in view while
 * people scroll through a long form.
 */
export function SaveBar({ status, problem, note }: { status: SaveStatus; problem: string | null; note: string }) {
  return (
    <>
      <div
        aria-live="polite"
        className="hairline sticky top-16 z-30 -mx-1 flex items-center justify-between gap-3 rounded-lg border bg-page/95 px-4 py-2.5 text-sm backdrop-blur-sm print:hidden"
      >
        <span className="text-driftwood-deep">{note}</span>
        <span
          className={
            status === 'error' ? 'font-medium text-clay-deep' : status === 'saving' ? 'text-driftwood' : 'text-seaglass-deep'
          }
        >
          {statusLabel(status)}
        </span>
      </div>

      {problem ? (
        <p className="rounded-lg bg-clay-wash px-4 py-3 text-sm leading-relaxed text-clay-deep">
          {problem} What you typed is still on the page, and it will try again when you keep going.
        </p>
      ) : null}
    </>
  )
}
