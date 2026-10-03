'use client'

import { useState, useTransition } from 'react'
import { answerOpenItem } from './actions'

export function AnswerBox({ itemId, projectSlug }: { itemId: string; projectSlug: string }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const answer = value.trim()
    if (!answer) {
      setError('Put something in the box first.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await answerOpenItem(itemId, answer, projectSlug)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor={`answer-${itemId}`}>
        Your answer
      </label>
      <textarea
        id={`answer-${itemId}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={2}
        placeholder="Answer this one here"
        className="hairline w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-ink placeholder:text-driftwood focus:border-seaglass focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-ink px-3 py-1.5 text-sm text-oyster transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving' : 'Send to Davina'}
        </button>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </div>
  )
}
