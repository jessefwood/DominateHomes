'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { putFileBack, putMessageBack } from './actions'

/**
 * One button. No confirmation, because putting something back is the safe
 * direction and nobody needs protecting from it.
 */
export function Restore({ id, kind }: { id: string; kind: 'file' | 'message' }) {
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
            const result = await runAction(() =>
              kind === 'file' ? putFileBack(id) : putMessageBack(id),
            )
            if (result.error) {
              setError(result.error)
              return
            }
            router.refresh()
          })
        }
        className="rounded-md bg-ink px-3 py-1.5 text-xs text-page transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Putting back' : 'Put it back'}
      </button>
      {error ? <span className="text-xs text-clay-deep">{error}</span> : null}
    </span>
  )
}
