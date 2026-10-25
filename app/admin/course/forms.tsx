'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { inviteAgents, saveStartingNumbers, type LineResult } from './actions'

/** Pasting in the agents. Each line gets its own result underneath. */
export function InviteAgentsForm() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [results, setResults] = useState<LineResult[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">One agent per line: name, then email</span>
        <textarea
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'Anthony Perry, anthony@example.com\nAmber Cuono, amber@example.com'}
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 font-mono text-sm text-ink placeholder:text-driftwood/70"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!text.includes('@') || pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const outcome = await inviteAgents(text)
                setResults(outcome.results)
                setProblem(null)
                // Keep only the lines that did not go, so fixing a typo and
                // pressing the button again does not re-invite everyone else.
                setText(outcome.results.filter((r) => !r.ok).map((r) => r.line).join('\n'))
                router.refresh()
              } catch {
                setProblem('That did not go through. Refresh the page and try again.')
              }
            })
          }
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Sending' : 'Send the invitations'}
        </button>
        <span className="text-xs leading-relaxed text-driftwood">
          Each agent gets an email with a link that sets up their account and opens the course. It lasts a week.
        </span>
      </div>

      {problem ? <p className="text-sm text-clay-deep">{problem}</p> : null}

      {results ? (
        <ul className="space-y-1 text-sm">
          {results.map((result) => (
            <li key={result.line} className={result.ok ? 'text-seaglass-deep' : 'text-clay-deep'}>
              {result.ok ? '✓' : '✕'} {result.message}
              {result.ok ? null : <span className="text-driftwood"> ({result.line})</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Pasting in where each agent's plan starts. Same shape as the invitations. */
export function StartingNumbersForm() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [results, setResults] = useState<LineResult[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs tracking-widest text-driftwood uppercase">
          One agent per line: name, email, 2026 closings, listing sides, buyer sides, take-home per closing, database, 2027 target
        </span>
        <textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'Anthony Perry, anthony@example.com, 3, 2, 0, 4850, 50, 10'}
          className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 font-mono text-sm text-ink placeholder:text-driftwood/70"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!text.includes('@') || pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const outcome = await saveStartingNumbers(text)
                setResults(outcome.results)
                setProblem(null)
                setText(outcome.results.filter((r) => !r.ok).map((r) => r.line).join('\n'))
                router.refresh()
              } catch {
                setProblem('That did not go through. Refresh the page and try again.')
              }
            })
          }
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Loading' : 'Load the numbers'}
        </button>
        <span className="text-xs leading-relaxed text-driftwood">
          Write numbers without commas: 4850, not 4,850. Loading an address again replaces its numbers.
        </span>
      </div>

      {problem ? <p className="text-sm text-clay-deep">{problem}</p> : null}

      {results ? (
        <ul className="space-y-1 text-sm">
          {results.map((result) => (
            <li key={result.line} className={result.ok ? 'text-seaglass-deep' : 'text-clay-deep'}>
              {result.ok ? '✓' : '✕'} {result.message}
              {result.ok ? null : <span className="text-driftwood"> ({result.line})</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
