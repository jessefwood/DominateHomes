'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { notifyClientsOfDesignerActivity } from '@/lib/notify'
import {
  askClient,
  closeOpenItem,
  OpenItemError,
  reachableClients,
  reopenOpenItem,
} from '@/lib/open-items'
import { requireDesigner } from '@/lib/session'

/**
 * Asking the client something, from the project she is being asked about.
 *
 * Designer only, checked in each action rather than relying on the admin
 * layout, because a server action is a public endpoint and these write to a
 * client's project and send her email.
 */

type Result = { error?: string; ok?: true; note?: string }

async function project(slug: string) {
  const row = await prisma.project.findUnique({ where: { slug } })
  if (!row) throw new OpenItemError('No such project.')
  return row
}

function refresh(slug: string) {
  revalidatePath(`/admin/projects/${slug}`)
  revalidatePath(`/portal/${slug}`, 'layout')
}

export async function ask(
  slug: string,
  values: { title: string; detail?: string; blocksOrdering?: string; email?: string },
): Promise<Result> {
  const actor = await requireDesigner()

  try {
    const target = await project(slug)
    const item = await askClient(actor, target, {
      title: values.title,
      detail: values.detail,
      blocksOrdering: values.blocksOrdering === 'on',
    })

    refresh(slug)

    if (values.email !== 'on') {
      return { ok: true, note: 'Asked. It is on her dashboard now, under what we need from you.' }
    }

    const clients = await reachableClients(target.id)

    if (clients.length === 0) {
      // Worth saying rather than silently not sending. The usual cause is
      // that the client's access has not been opened yet, which is a
      // deliberate state, not a fault.
      return {
        ok: true,
        note: 'Asked, and it is on her dashboard. No email went out, because nobody on this project can sign in yet.',
      }
    }

    await notifyClientsOfDesignerActivity({
      project: target,
      headline: `${actor.name.split(' ')[0]} has a question about the house`,
      body: [values.title.trim(), values.detail?.trim()].filter(Boolean).join('\n\n'),
      path: `/portal/${target.slug}/open-items#item-${item.id}`,
      linkLabel: 'Answer it',
    })

    return {
      ok: true,
      note: `Asked, and emailed to ${clients.map((client) => client.name.split(' ')[0]).join(' and ')}.`,
    }
  } catch (error) {
    if (error instanceof OpenItemError) return { error: error.message }
    throw error
  }
}

export async function close(slug: string, itemId: string): Promise<Result> {
  await requireDesigner()

  try {
    const target = await project(slug)
    await closeOpenItem(itemId, target.id)
  } catch (error) {
    if (error instanceof OpenItemError) return { error: error.message }
    throw error
  }

  refresh(slug)
  return { ok: true }
}

export async function reopen(slug: string, itemId: string): Promise<Result> {
  await requireDesigner()

  try {
    const target = await project(slug)
    await reopenOpenItem(itemId, target.id)
  } catch (error) {
    if (error instanceof OpenItemError) return { error: error.message }
    throw error
  }

  refresh(slug)
  return { ok: true }
}
