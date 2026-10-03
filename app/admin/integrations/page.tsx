import { PageHeader } from '@/components/ui'
import { credentialKeyConfigured } from '@/lib/crypto'
import { listIntegrations } from '@/lib/integrations'
import { IntegrationPanel, type PanelData } from './panel'

export const dynamic = 'force-dynamic'

export default async function IntegrationsPage() {
  const integrations = await listIntegrations()
  const keyReady = credentialKeyConfigured()

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
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Integrations"
        intro="Connect the outside services the portal uses. Paste a key once and it is encrypted before it is stored. Nothing here is shown again afterwards."
      />

      {!keyReady ? (
        <div className="rounded-md border border-clay/30 bg-clay-wash p-4">
          <p className="font-medium text-clay-deep">This server cannot store keys safely yet</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-driftwood-deep">
            CREDENTIAL_KEY is not set in the hosting environment, so there is nothing to encrypt with and
            saving a key will be refused rather than stored in the clear. Generate one with{' '}
            <code className="font-mono text-xs">openssl rand -base64 32</code> and add it as a variable in
            Railway, then reload this page.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {panels.map((panel) => (
          <IntegrationPanel key={panel.kind} data={panel} />
        ))}
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-driftwood">
        Encrypting a key protects it if the database is ever read or copied. It cannot protect it from someone
        who gets into the running server, because the server has to decrypt the key in order to use it. If a
        key is ever exposed, roll it in Stripe or Resend and paste the new one here.
      </p>
    </div>
  )
}
