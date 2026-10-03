'use server'

import { revalidatePath } from 'next/cache'
import { IntegrationKind } from '@prisma/client'
import {
  checkIntegration,
  connectIntegration,
  CredentialRejected,
  disconnectIntegration,
  setIntegrationEnabled,
} from '@/lib/integrations'
import { requireDesigner } from '@/lib/session'

type Result = { error?: string; note?: string; ok?: true }

/**
 * Every action here is designer only. A secret arrives, is encrypted and
 * stored, and is never sent back to a browser.
 */

export async function connect(
  kind: IntegrationKind,
  secret: string,
  publicValue: string,
  label: string,
): Promise<Result> {
  const user = await requireDesigner()

  try {
    await connectIntegration({ kind, secret, publicValue, label, userId: user.id })
    revalidatePath('/admin/integrations')
    revalidatePath('/admin')
    return { ok: true }
  } catch (error) {
    if (error instanceof CredentialRejected) return { error: error.message }
    console.error('Connecting an integration failed', error)
    return { error: 'That did not save. Nothing was stored.' }
  }
}

export async function test(kind: IntegrationKind): Promise<Result> {
  const user = await requireDesigner()
  const result = await checkIntegration(kind, user.id)
  revalidatePath('/admin/integrations')
  return result.ok ? { ok: true, note: result.note } : { error: result.note }
}

export async function toggle(kind: IntegrationKind, enabled: boolean): Promise<Result> {
  const user = await requireDesigner()
  await setIntegrationEnabled(kind, enabled, user.id)
  revalidatePath('/admin/integrations')
  return { ok: true }
}

export async function disconnect(kind: IntegrationKind): Promise<Result> {
  const user = await requireDesigner()
  await disconnectIntegration(kind, user.id)
  revalidatePath('/admin/integrations')
  revalidatePath('/admin')
  return { ok: true }
}
