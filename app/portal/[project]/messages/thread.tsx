'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { remove, send } from './actions'

/**
 * The box at the bottom of the thread.
 *
 * Enter sends, shift and enter makes a new line, which is what everybody
 * expects from a message box and what nobody expects from a form. The
 * textarea grows with what is typed rather than scrolling inside four lines.
 *
 * `maxLength` arrives as a prop rather than being imported from lib/messages,
 * because that module imports lib/db and pulling it in here would put the
 * Postgres driver in the browser bundle. Same reason the option picker
 * declares its three slots locally.
 */
export function Composer({
  projectSlug,
  maxLength,
}: {
  projectSlug: string
  maxLength: number
}) {
  const router = useRouter()
  const box = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ready = body.trim().length > 0 && body.length <= maxLength

  function grow() {
    const element = box.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 320)}px`
  }

  function submit() {
    if (!ready || pending) return
    setError(null)

    startTransition(async () => {
      const result = await runAction(() => send(projectSlug, body))
      if (result.error) {
        setError(result.error)
        return
      }
      setBody('')
      if (box.current) box.current.style.height = 'auto'
      router.refresh()
    })
  }

  const over = body.length > maxLength

  return (
    <div className="hairline sticky bottom-0 border-t bg-page/90 pt-4 pb-6 backdrop-blur-sm">
      <textarea
        ref={box}
        rows={2}
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
          grow()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="Anything at all. A question, a measurement, something you have changed your mind about."
        className="hairline w-full resize-none rounded-lg border bg-page px-3.5 py-3 text-[15px] leading-relaxed text-ink placeholder:text-driftwood/70"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs ${over ? 'text-clay-deep' : 'text-driftwood'}`}>
          {over
            ? `${(body.length - maxLength).toLocaleString()} characters too long. Send the rest as a file.`
            : 'Enter sends it. Shift and enter starts a new line.'}
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Sending' : 'Send'}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm leading-relaxed text-clay-deep">{error}</p> : null}
    </div>
  )
}

/** Taking a message back. Two clicks, same as a file. */
export function RemoveMessage({
  projectSlug,
  messageId,
}: {
  projectSlug: string
  messageId: string
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-xs text-driftwood/70 underline underline-offset-2 transition-colors hover:text-clay-deep"
      >
        Remove
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runAction(() => remove(projectSlug, messageId))
            if (result.error) {
              setError(result.error)
              setAsking(false)
              return
            }
            router.refresh()
          })
        }
        className="text-xs text-clay-deep underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? 'Removing' : 'Really remove'}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="text-xs text-driftwood underline underline-offset-2"
      >
        Keep it
      </button>
      {error ? <span className="text-xs text-clay-deep">{error}</span> : null}
    </span>
  )
}
