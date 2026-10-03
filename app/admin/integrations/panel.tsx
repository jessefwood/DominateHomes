'use client'

import { useState, useTransition } from 'react'
import { Pill } from '@/components/ui'
import { connect, disconnect, test, toggle } from './actions'

/** Plain data only. The secret itself never reaches this component. */
export type PanelData = {
  kind: 'STRIPE' | 'RESEND'
  name: string
  blurb: string
  docsNote: string
  secretLabel: string
  publicLabel: string | null
  connected: boolean
  enabled: boolean
  publicValue: string | null
  secretHint: string | null
  lastCheckedAt: string | null
  lastCheckOk: boolean | null
  lastCheckNote: string | null
}

export function IntegrationPanel({ data }: { data: PanelData }) {
  const [secret, setSecret] = useState('')
  const [publicValue, setPublicValue] = useState(data.publicValue ?? '')
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ error?: string; note?: string }>) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) setMessage({ kind: 'bad', text: result.error })
      else if (result.note) setMessage({ kind: 'ok', text: result.note })
    })
  }

  return (
    <div className="hairline rounded-lg border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-ink">{data.name}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-driftwood-deep">{data.blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.connected ? (
            <Pill tone={data.enabled ? 'sea' : 'neutral'}>{data.enabled ? 'On' : 'Off'}</Pill>
          ) : (
            <Pill tone="clay">Not connected</Pill>
          )}
        </div>
      </div>

      {data.connected ? (
        <div className="hairline mt-4 space-y-1 border-t pt-4 text-sm">
          <p className="text-driftwood-deep">
            {data.secretLabel} ending <span className="text-ink">{data.secretHint}</span>
          </p>
          {data.publicValue ? (
            <p className="text-driftwood-deep">
              {data.publicLabel}: <span className="text-ink">{data.publicValue}</span>
            </p>
          ) : null}
          {data.lastCheckedAt ? (
            <p className={data.lastCheckOk ? 'text-seaglass-deep' : 'text-clay-deep'}>
              {data.lastCheckOk ? 'Working. ' : 'Problem. '}
              {data.lastCheckNote}
            </p>
          ) : (
            <p className="text-driftwood">Not tested yet. Press Test to make a real call to {data.name}.</p>
          )}
        </div>
      ) : null}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-driftwood-deep hover:text-ink">
          {data.connected ? 'Replace the key' : `Connect ${data.name}`}
        </summary>

        <div className="mt-3 space-y-3">
          <p className="max-w-xl text-sm leading-relaxed text-driftwood">{data.docsNote}</p>

          <div>
            <label className="text-sm text-driftwood-deep" htmlFor={`secret-${data.kind}`}>
              {data.secretLabel}
            </label>
            <input
              id={`secret-${data.kind}`}
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="hairline mt-1 w-full max-w-md rounded-md border bg-white px-3 py-2 font-mono text-sm text-ink focus:border-seaglass focus:outline-none"
              placeholder="Paste it here"
            />
          </div>

          {data.publicLabel ? (
            <div>
              <label className="text-sm text-driftwood-deep" htmlFor={`public-${data.kind}`}>
                {data.publicLabel}
              </label>
              <input
                id={`public-${data.kind}`}
                value={publicValue}
                onChange={(event) => setPublicValue(event.target.value)}
                spellCheck={false}
                className="hairline mt-1 w-full max-w-md rounded-md border bg-white px-3 py-2 font-mono text-sm text-ink focus:border-seaglass focus:outline-none"
              />
            </div>
          ) : null}

          <div>
            <label className="text-sm text-driftwood-deep" htmlFor={`label-${data.kind}`}>
              A note for yourself, optional
            </label>
            <input
              id={`label-${data.kind}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="hairline mt-1 w-full max-w-md rounded-md border bg-white px-3 py-2 text-sm text-ink focus:border-seaglass focus:outline-none"
              placeholder="Live account, test account, and so on"
            />
          </div>

          <button
            type="button"
            disabled={pending || !secret.trim()}
            onClick={() => {
              run(() => connect(data.kind, secret, publicValue, label))
              setSecret('')
            }}
            className="rounded-md bg-ink px-4 py-2 text-sm text-oyster transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? 'Saving' : 'Save and connect'}
          </button>

          <p className="max-w-xl text-xs leading-relaxed text-driftwood">
            The key is encrypted before it is stored and is never shown again, here or anywhere else. Only the
            last four characters are kept so you can tell which one is in place.
          </p>
        </div>
      </details>

      {data.connected ? (
        <div className="hairline mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => test(data.kind))}
            className="hairline rounded-md border px-3 py-1.5 text-sm text-ink transition-colors hover:bg-sand/50 disabled:opacity-50"
          >
            {pending ? 'Testing' : 'Test'}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => toggle(data.kind, !data.enabled))}
            className="text-sm text-driftwood-deep underline underline-offset-2 disabled:opacity-50"
          >
            {data.enabled ? 'Switch off' : 'Switch on'}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Disconnect ${data.name}? The stored key is deleted and cannot be recovered.`)) {
                run(() => disconnect(data.kind))
              }
            }}
            className="text-sm text-clay-deep underline underline-offset-2 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : null}

      {message ? (
        <p className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-seaglass-deep' : 'text-clay-deep'}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
