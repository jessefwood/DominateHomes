'use client'

import { useState, useTransition } from 'react'
import { Pill } from '@/components/ui'
import { setSignIn } from './users-actions'

export function UserRow({
  id,
  name,
  email,
  isDesigner,
  signInEnabled,
}: {
  id: string
  name: string
  email: string
  isDesigner: boolean
  signInEnabled: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    setError(null)
    startTransition(async () => {
      const result = await setSignIn(id, !signInEnabled)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{name}</p>
          <p className="mt-0.5 text-sm text-driftwood">{email}</p>
        </div>

        <div className="flex items-center gap-3">
          <Pill tone={isDesigner ? 'ink' : 'neutral'}>{isDesigner ? 'Admin' : 'Client'}</Pill>
          <Pill tone={signInEnabled ? 'sea' : 'clay'}>
            {signInEnabled ? 'Can sign in' : 'Locked out'}
          </Pill>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="hairline rounded-md border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-sand/50 disabled:opacity-50"
          >
            {pending ? 'Saving' : signInEnabled ? 'Lock out' : 'Let them in'}
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-clay-deep">{error}</p> : null}
    </div>
  )
}
