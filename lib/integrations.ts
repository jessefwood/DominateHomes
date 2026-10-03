import { IntegrationKind, type Integration } from '@prisma/client'
import { credentialKeyConfigured, decryptSecret, encryptSecret, hint } from './crypto'
import { prisma } from './db'

/**
 * Connecting third party services from the admin screen.
 *
 * The design rule here: a secret goes in and never comes back out to a
 * browser. `publicSummary` is what the screen is allowed to render. The only
 * reader of the real secret is server code about to call the service.
 */

export type IntegrationSpec = {
  kind: IntegrationKind
  name: string
  blurb: string
  /** What the secret looks like, so a wrong paste is caught before it is stored. */
  secretLabel: string
  secretPrefix: string | null
  publicLabel: string | null
  publicPrefix: string | null
  docsNote: string
}

export const INTEGRATIONS: IntegrationSpec[] = [
  {
    kind: IntegrationKind.STRIPE,
    name: 'Stripe',
    blurb: 'Takes deposits and payments from clients. Nothing is charged without you setting it up here first.',
    secretLabel: 'Secret key',
    secretPrefix: 'sk_',
    publicLabel: 'Publishable key',
    publicPrefix: 'pk_',
    docsNote:
      'Both keys are in the Stripe dashboard under Developers, API keys. Use the live keys when you are ready to take real money, and the test keys until then.',
  },
  {
    kind: IntegrationKind.RESEND,
    name: 'Resend',
    blurb: 'Sends the sign-in links clients use to get into their portal. Without it nobody can log in.',
    secretLabel: 'API key',
    secretPrefix: 're_',
    publicLabel: 'Send from address',
    publicPrefix: null,
    docsNote:
      'The API key is in the Resend dashboard under API Keys. The from address has to be on a domain you have verified with Resend.',
  },
]

export function spec(kind: IntegrationKind): IntegrationSpec {
  const found = INTEGRATIONS.find((entry) => entry.kind === kind)
  if (!found) throw new Error(`No integration spec for ${kind}`)
  return found
}

/** Everything the admin screen is allowed to know. Never includes the secret. */
export type IntegrationSummary = {
  kind: IntegrationKind
  name: string
  blurb: string
  docsNote: string
  secretLabel: string
  publicLabel: string | null
  connected: boolean
  enabled: boolean
  label: string | null
  publicValue: string | null
  secretHint: string | null
  lastCheckedAt: Date | null
  lastCheckOk: boolean | null
  lastCheckNote: string | null
}

function summarise(spec: IntegrationSpec, row: Integration | undefined): IntegrationSummary {
  return {
    kind: spec.kind,
    name: spec.name,
    blurb: spec.blurb,
    docsNote: spec.docsNote,
    secretLabel: spec.secretLabel,
    publicLabel: spec.publicLabel,
    connected: Boolean(row?.secretCipher),
    enabled: row?.enabled ?? false,
    label: row?.label ?? null,
    publicValue: row?.publicValue ?? null,
    secretHint: row?.secretHint ?? null,
    lastCheckedAt: row?.lastCheckedAt ?? null,
    lastCheckOk: row?.lastCheckOk ?? null,
    lastCheckNote: row?.lastCheckNote ?? null,
  }
}

export async function listIntegrations(): Promise<IntegrationSummary[]> {
  const rows = await prisma.integration.findMany()
  return INTEGRATIONS.map((entry) => summarise(entry, rows.find((row) => row.kind === entry.kind)))
}

export class CredentialRejected extends Error {}

export async function connectIntegration(input: {
  kind: IntegrationKind
  secret: string
  publicValue?: string | null
  label?: string | null
  userId: string
}) {
  if (!credentialKeyConfigured()) {
    throw new CredentialRejected(
      'This server cannot store credentials safely yet because CREDENTIAL_KEY is not set. ' +
        'Nothing was saved. Set it in the hosting environment and try again.',
    )
  }

  const entry = spec(input.kind)
  const secret = input.secret.trim()
  const publicValue = input.publicValue?.trim() || null

  if (!secret) throw new CredentialRejected(`${entry.secretLabel} cannot be empty.`)

  // Catch the common paste mistakes before a wrong key reaches a payment
  // provider and fails in a confusing way later.
  if (entry.secretPrefix && !secret.startsWith(entry.secretPrefix)) {
    throw new CredentialRejected(
      `That does not look like a ${entry.name} ${entry.secretLabel.toLowerCase()}. ` +
        `It should start with ${entry.secretPrefix}. Check you have not pasted the wrong one of the two keys.`,
    )
  }

  if (entry.publicPrefix && publicValue && !publicValue.startsWith(entry.publicPrefix)) {
    throw new CredentialRejected(
      `The ${entry.publicLabel?.toLowerCase()} should start with ${entry.publicPrefix}.`,
    )
  }

  return prisma.integration.upsert({
    where: { kind: input.kind },
    create: {
      kind: input.kind,
      secretCipher: encryptSecret(secret),
      secretHint: hint(secret),
      publicValue,
      label: input.label?.trim() || null,
      enabled: true,
      updatedByUserId: input.userId,
      lastCheckedAt: null,
      lastCheckOk: null,
      lastCheckNote: null,
    },
    update: {
      secretCipher: encryptSecret(secret),
      secretHint: hint(secret),
      publicValue,
      label: input.label?.trim() || null,
      enabled: true,
      updatedByUserId: input.userId,
      lastCheckedAt: null,
      lastCheckOk: null,
      lastCheckNote: null,
    },
  })
}

export async function setIntegrationEnabled(kind: IntegrationKind, enabled: boolean, userId: string) {
  return prisma.integration.update({
    where: { kind },
    data: { enabled, updatedByUserId: userId },
  })
}

export async function disconnectIntegration(kind: IntegrationKind, userId: string) {
  return prisma.integration.update({
    where: { kind },
    data: {
      secretCipher: null,
      secretHint: null,
      publicValue: null,
      enabled: false,
      lastCheckedAt: null,
      lastCheckOk: null,
      lastCheckNote: null,
      updatedByUserId: userId,
    },
  })
}

/**
 * Reads a secret back for server code that is about to call the service.
 * Nothing that returns to a browser may call this.
 */
export async function secretFor(kind: IntegrationKind): Promise<string | null> {
  const row = await prisma.integration.findUnique({ where: { kind } })
  if (!row?.secretCipher || !row.enabled) return null
  return decryptSecret(row.secretCipher)
}

/**
 * Calls the service to prove the credential actually works. A key that is
 * stored but wrong is worse than no key, because it fails at the moment a
 * client is trying to pay.
 */
export async function checkIntegration(kind: IntegrationKind, userId: string) {
  const secret = await secretFor(kind)

  if (!secret) {
    return { ok: false, note: 'Not connected, or switched off.' }
  }

  let ok = false
  let note = ''

  try {
    if (kind === IntegrationKind.STRIPE) {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: { Authorization: `Bearer ${secret}` },
      })
      ok = response.ok
      if (ok) {
        const account = (await response.json()) as { id?: string; business_profile?: { name?: string } }
        note = `Connected to ${account.business_profile?.name ?? account.id ?? 'a Stripe account'}.`
      } else {
        note = `Stripe refused the key (${response.status}). Check you pasted the secret key and not an old one.`
      }
    } else {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${secret}` },
      })
      ok = response.ok
      note = ok
        ? 'Key works.'
        : `Resend refused the key (${response.status}). Check it has sending permission.`
    }
  } catch (error) {
    ok = false
    note = `Could not reach the service. ${error instanceof Error ? error.message : ''}`.trim()
  }

  await prisma.integration.update({
    where: { kind },
    data: { lastCheckedAt: new Date(), lastCheckOk: ok, lastCheckNote: note, updatedByUserId: userId },
  })

  return { ok, note }
}
