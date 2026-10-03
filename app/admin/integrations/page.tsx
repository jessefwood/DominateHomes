import { PageHeader } from '@/components/ui'
import { configuredCredentialKey, credentialKeyProblem, KEY_PROBLEM_DETAIL } from '@/lib/crypto'
import { listIntegrations } from '@/lib/integrations'
import { IntegrationPanel, type PanelData } from './panel'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const integrations = await listIntegrations()
  const keyProblem = credentialKeyProblem(configuredCredentialKey())

  const panels: PanelData[] = integrations.map((entry) => ({
    kind: entry.kind,
    name: entry.name,
    blurb: entry.blurb,
    docsNote: entry.docsNote,
    secretLabel: entry.secretLabel,
    publicLabel: entry.publicLabel,
    connected: entry.connected,
    enabled: entry.enabled,
    publicValue: entry.publicValue,
    secretHint: entry.secretHint,
    lastCheckedAt: entry.lastCheckedAt ? entry.lastCheckedAt.toISOString() : null,
    lastCheckOk: entry.lastCheckOk,
    lastCheckNote: entry.lastCheckNote,
    managedElsewhere: entry.managedElsewhere,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Integrations"
        intro="Connect the outside services the portal uses. Paste a key once and it is encrypted before it is stored. Nothing here is shown again afterwards."
      />

      {keyProblem ? (
        <div className="rounded-md border border-clay/30 bg-clay-wash p-4">
          <p className="font-medium text-clay-deep">This server cannot store keys safely yet</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-driftwood-deep">
            {KEY_PROBLEM_DETAIL[keyProblem]} Saving a key here is refused rather than stored under
            something that is not a secret.
          </p>
          <ol className="mt-3 max-w-2xl space-y-1.5 text-sm leading-relaxed text-driftwood-deep">
            <li>
              1. Run this in a terminal:{' '}
              <code className="font-mono text-xs">openssl rand -base64 32</code>
            </li>
            <li>
              2. It prints 44 characters ending in <code className="font-mono text-xs">=</code>.
              That printed line is the value, not the command.
            </li>
            <li>
              3. In Railway, set <code className="font-mono text-xs">CREDENTIAL_KEY</code> to it,
              redeploy, then reload this page. The warning goes away only once the value is right.
            </li>
          </ol>
        </div>
      ) : null}

      <div className="space-y-4">
        {panels.map((panel) => (
          <IntegrationPanel key={panel.kind} data={panel} />
        ))}
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-driftwood">
        Encrypting a key protects it if the database is ever read or copied. It cannot protect it
        from someone who gets into the running server, because the server has to decrypt the key in
        order to use it. If a key is ever exposed, roll it in Stripe or Resend and paste the new one
        here.
      </p>
    </div>
  )
}
