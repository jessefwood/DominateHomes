'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { approveRequest, declineRequest, invite, withdrawInvite } from './actions'

/**
 * The three things on the People screen that write.
 *
 * All of them show the result where the person clicked rather than at the top
 * of the page. With several requests on screen, a message at the top does not
 * say which one it was about.
 */

export type ProjectChoice = { id: string; displayName: string }

function Result({ result }: { result: { error?: string; ok?: true } | null }) {
  if (!result) return null
  if (result.error) return <p className="mt-2 text-sm leading-relaxed text-clay-deep">{result.error}</p>
  return <p className="mt-2 text-sm text-seaglass-deep">Done.</p>
}

/** Inviting somebody who has not asked. The ordinary case. */
export function InviteForm({ projects }: { projects: ProjectChoice[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [label, setLabel] = useState('')
  const [result, setResult] = useState<{ error?: string; ok?: true } | null>(null)
  const [pending, startTransition] = useTransition()

  const ready = name.trim().length > 0 && email.includes('@')

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">Their name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Abbie Tigges"
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">Their email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="abbie@example.com"
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">Which project</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.displayName}
              </option>
            ))}
            <option value="">No project yet</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">
            How to address them
          </span>
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Abbie and Russell"
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
          />
          <span className="mt-1 block text-xs leading-relaxed text-driftwood">
            Optional. Used where the portal talks to them directly.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await runAction(() =>
                invite({ name, email, projectId: projectId || null, label: label || null }),
              )
              setResult(outcome)
              if (!outcome.error) {
                setName('')
                setEmail('')
                setLabel('')
                router.refresh()
              }
            })
          }
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Sending' : 'Send the invitation'}
        </button>

        <span className="text-xs leading-relaxed text-driftwood">
          They get an email with a link that sets up their account. It lasts a week.
        </span>
      </div>

      <Result result={result} />
    </div>
  )
}

/** Approving or declining somebody who asked through the public form. */
export function RequestRow({
  requestId,
  projects,
}: {
  requestId: string
  projects: ProjectChoice[]
}) {
  const router = useRouter()
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [decliningNote, setDecliningNote] = useState<string | null>(null)
  const [result, setResult] = useState<{ error?: string; ok?: true } | null>(null)
  const [pending, startTransition] = useTransition()

  function run(work: () => Promise<{ error?: string; ok?: true }>) {
    startTransition(async () => {
      const outcome = await runAction(work)
      setResult(outcome)
      if (!outcome.error) router.refresh()
    })
  }

  if (decliningNote !== null) {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">
            Why, for our records
          </span>
          <input
            type="text"
            value={decliningNote}
            onChange={(event) => setDecliningNote(event.target.value)}
            placeholder="Out of our area"
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
          />
          <span className="mt-1 block text-xs leading-relaxed text-driftwood">
            They are not told anything. Declining sends no email.
          </span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => declineRequest(requestId, decliningNote))}
            className="rounded-md bg-ink px-3 py-1.5 text-sm text-page disabled:opacity-50"
          >
            {pending ? 'Declining' : 'Decline it'}
          </button>
          <button
            type="button"
            onClick={() => setDecliningNote(null)}
            className="text-sm text-driftwood underline underline-offset-2"
          >
            Back
          </button>
        </div>
        <Result result={result} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">Put them on</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="hairline mt-1.5 rounded-md border bg-page px-3 py-2 text-sm text-ink"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.displayName}
              </option>
            ))}
            <option value="">No project yet</option>
          </select>
        </label>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveRequest(requestId, projectId || null))}
          className="rounded-md bg-ink px-3 py-2 text-sm text-page disabled:opacity-50"
        >
          {pending ? 'Approving' : 'Approve and invite'}
        </button>

        <button
          type="button"
          onClick={() => setDecliningNote('')}
          className="py-2 text-sm text-driftwood underline underline-offset-2 hover:text-ink"
        >
          Decline
        </button>
      </div>
      <Result result={result} />
    </div>
  )
}

/** Withdrawing an invitation that has not been opened. */
export function WithdrawInvite({ inviteId, email }: { inviteId: string; email: string }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState<{ error?: string; ok?: true } | null>(null)
  const [pending, startTransition] = useTransition()

  if (!asking) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="text-sm text-driftwood underline underline-offset-2 hover:text-clay-deep"
        >
          Withdraw
        </button>
        <Result result={result} />
      </>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-driftwood">Stop the link to {email} working?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await runAction(() => withdrawInvite(inviteId))
            setResult(outcome)
            setAsking(false)
            if (!outcome.error) router.refresh()
          })
        }
        className="rounded bg-ink px-2 py-0.5 text-xs text-page disabled:opacity-50"
      >
        {pending ? 'Withdrawing' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="text-xs text-driftwood underline underline-offset-2"
      >
        No
      </button>
    </span>
  )
}
