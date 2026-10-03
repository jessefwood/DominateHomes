'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { ask, close, reopen } from './asks-actions'

/**
 * Asking the client something, and dealing with what is already asked.
 *
 * The email tick is on by default. The point of asking through the portal
 * rather than by text is that the answer stays on the project, and that only
 * works if she knows there is a question. Defaulting it off would mean
 * questions quietly sitting on a dashboard nobody opened.
 */
export function AskClient({ slug }: { slug: string }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [blocks, setBlocks] = useState(false)
  const [email, setEmail] = useState(true)
  const [result, setResult] = useState<{ error?: string; ok?: true; note?: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const ready = title.trim().length > 0

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">The question</span>
        <input
          type="text"
          value={title}
          onChange={(event) => {
            setResult(null)
            setTitle(event.target.value)
          }}
          placeholder="What width are the great room windows, floor to ceiling?"
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
        />
      </label>

      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">
          Anything that helps her answer it
        </span>
        <textarea
          rows={3}
          value={detail}
          onChange={(event) => {
            setResult(null)
            setDetail(event.target.value)
          }}
          placeholder="A photo of the wall with a tape measure in it is perfect. You can send it on the Files page."
          className="hairline mt-1.5 w-full resize-y rounded-md border bg-page px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-driftwood/70"
        />
      </label>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-driftwood-deep">
          <input
            type="checkbox"
            checked={blocks}
            onChange={(event) => setBlocks(event.target.checked)}
            className="size-4 rounded border-ink/30"
          />
          This holds up an order
        </label>

        <label className="flex items-center gap-2 text-sm text-driftwood-deep">
          <input
            type="checkbox"
            checked={email}
            onChange={(event) => setEmail(event.target.checked)}
            className="size-4 rounded border-ink/30"
          />
          Email it to her as well
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await runAction(() =>
                ask(slug, {
                  title,
                  detail,
                  blocksOrdering: blocks ? 'on' : '',
                  email: email ? 'on' : '',
                }),
              )
              setResult(outcome)
              if (!outcome.error) {
                setTitle('')
                setDetail('')
                setBlocks(false)
                router.refresh()
              }
            })
          }
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Asking' : 'Ask her'}
        </button>

        <span className="text-xs leading-relaxed text-driftwood">
          It lands on her dashboard under what we need from you, and the answer stays on the
          project.
        </span>
      </div>

      {result?.error ? (
        <p className="text-sm leading-relaxed text-clay-deep">{result.error}</p>
      ) : result?.note ? (
        <p className="text-sm leading-relaxed text-seaglass-deep">{result.note}</p>
      ) : null}
    </div>
  )
}

/** Closing one off, or putting it back. */
export function ItemState({
  slug,
  itemId,
  closed,
}: {
  slug: string
  itemId: string
  closed: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await runAction(() =>
              closed ? reopen(slug, itemId) : close(slug, itemId),
            )
            if (outcome.error) {
              setError(outcome.error)
              return
            }
            router.refresh()
          })
        }
        className="text-xs text-driftwood underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-50"
      >
        {pending ? 'Saving' : closed ? 'Open it again' : 'Close it off'}
      </button>
      {error ? <span className="text-xs text-clay-deep">{error}</span> : null}
    </span>
  )
}
