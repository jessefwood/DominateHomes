'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { removeUpload } from './actions'

/**
 * Putting a file in the trash.
 *
 * Two clicks, because the first one is next to a photograph somebody drove to
 * a building site to take. The copy says where it goes rather than saying
 * "are you sure", because what people want to know is whether it is
 * recoverable.
 */
export function RemoveFile({
  projectSlug,
  uploadId,
  filename,
}: {
  projectSlug: string
  uploadId: string
  filename: string
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
        className="text-xs text-driftwood underline underline-offset-2 transition-colors hover:text-clay-deep"
      >
        Remove
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-driftwood">Move to the trash?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runAction(() => removeUpload(projectSlug, uploadId))
            if (result.error) {
              setError(result.error)
              setAsking(false)
              return
            }
            router.refresh()
          })
        }
        className="rounded bg-ink px-2 py-0.5 text-xs text-page disabled:opacity-50"
        aria-label={`Move ${filename} to the trash`}
      >
        {pending ? 'Removing' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="text-xs text-driftwood underline underline-offset-2"
      >
        No
      </button>
      {error ? <span className="text-xs text-clay-deep">{error}</span> : null}
    </span>
  )
}
