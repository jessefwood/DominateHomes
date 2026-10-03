'use server'

import { revalidatePath } from 'next/cache'
import { Phase } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  EditError,
  checkbox,
  moneyToCents,
  optionalMoneyToCents,
  optionalText,
  optionalUrl,
  optionalWholeNumber,
  requiredText,
} from '@/lib/editing'
import { requireDesigner } from '@/lib/session'

/**
 * Everything Davina can change about a project without asking anyone.
 *
 * Designers only, checked in every action rather than only in the layout. A
 * server action is a public endpoint: the layout guard decides who sees the
 * form, and nothing at all about who can post to it.
 *
 * Each action takes the plain values object the form holds, validates it, and
 * says what went wrong in a sentence. Nothing here is a partial update of a
 * row somebody else is also editing, because there is no concurrent editing to
 * speak of: two people, one project at a time.
 */

export type Result = { error?: string; note?: string; ok?: true }

/**
 * The phase comes from a select, so the only way to get a value that is not a
 * phase is to post to the action directly. Checked anyway: an unchecked cast
 * here would write a string Prisma then rejects at the driver, and the person
 * would get a stack trace instead of a sentence.
 */
function asPhase(raw: string | undefined): Phase {
  const value = raw?.trim()
  if (value && (Object.values(Phase) as string[]).includes(value)) return value as Phase
  throw new EditError('That is not one of the phases. Pick one from the list.')
}

type Values = Record<string, string>

async function guarded(work: () => Promise<Result>): Promise<Result> {
  await requireDesigner()

  try {
    return await work()
  } catch (error) {
    if (error instanceof EditError) return { error: error.message }
    throw error
  }
}

/** Everything under this project, since a rename changes the client's pages too. */
function revalidateProject(slug: string) {
  revalidatePath('/admin/projects')
  revalidatePath(`/admin/projects/${slug}`, 'layout')
  revalidatePath(`/portal/${slug}`, 'layout')
}

export async function saveProject(projectId: string, values: Values): Promise<Result> {
  return guarded(async () => {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return { error: 'That project is not here any more. Refresh the page.' }

    const addressLine = optionalText(values.addressLine)

    await prisma.project.update({
      where: { id: projectId },
      data: {
        displayName: requiredText(values.displayName, 'The project name'),
        addressLine,
        community: requiredText(values.community, 'The community'),
        clientName: requiredText(values.clientName, 'The client name'),
        phase: asPhase(values.phase),
        heroImageUrl: optionalUrl(values.heroImageUrl, 'The photo link'),
        heroCaption: optionalText(values.heroCaption),
        designerNote: optionalText(values.designerNote),
      },
    })

    revalidateProject(project.slug)

    // The naming convention is a street number and street name, and the
    // address is the thing that unlocks it. Saying so here is the only place
    // the person filling it in will be looking.
    if (!project.addressLine && addressLine) {
      return {
        note: 'Saved. Now that there is an address, the open item about it can be closed, and the web address of the project can be changed to match.',
      }
    }

    return { ok: true }
  })
}

export async function saveRoom(roomId: string, values: Values): Promise<Result> {
  return guarded(async () => {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { project: { select: { slug: true } } },
    })
    if (!room) return { error: 'That room is not here any more. Refresh the page.' }

    await prisma.room.update({
      where: { id: roomId },
      data: {
        name: requiredText(values.name, 'The room name'),
        photoUrl: optionalUrl(values.photoUrl, 'The photo link'),
        photoCaption: optionalText(values.photoCaption),
        contents: requiredText(values.contents, 'What is going in the room'),
        constraintNote: optionalText(values.constraintNote),
        unresolvedNote: optionalText(values.unresolvedNote),
      },
    })

    revalidateProject(room.project.slug)
    return { ok: true }
  })
}

export async function saveSelection(selectionId: string, values: Values): Promise<Result> {
  return guarded(async () => {
    const selection = await prisma.selection.findUnique({
      where: { id: selectionId },
      include: { room: { include: { project: { select: { slug: true } } } } },
    })
    if (!selection) return { error: 'That piece is not here any more. Refresh the page.' }

    await prisma.selection.update({
      where: { id: selectionId },
      data: {
        name: requiredText(values.name, 'The name'),
        category: requiredText(values.category, 'The category'),
        qty: optionalWholeNumber(values.qty, 'How many') ?? 1,
        notes: optionalText(values.notes),
        plannedLowCents: optionalMoneyToCents(values.plannedLow, 'The low end of the band'),
        plannedHighCents: optionalMoneyToCents(values.plannedHigh, 'The high end of the band'),
      },
    })

    revalidateProject(selection.room.project.slug)
    return { ok: true }
  })
}

export async function saveOption(optionId: string, values: Values): Promise<Result> {
  return guarded(async () => {
    const option = await prisma.selectionOption.findUnique({
      where: { id: optionId },
      include: {
        selection: { include: { room: { include: { project: { select: { slug: true } } } } } },
      },
    })
    if (!option) return { error: 'That option is not here any more. Refresh the page.' }

    await prisma.selectionOption.update({
      where: { id: optionId },
      data: {
        label: requiredText(values.label, 'The name of the option'),
        vendor: requiredText(values.vendor, 'The vendor'),
        priceCents: moneyToCents(values.price, 'The price'),
        photoUrl: optionalUrl(values.photoUrl, 'The photo link'),
        productUrl: optionalUrl(values.productUrl, 'The product page link'),
        colorway: optionalText(values.colorway),
        dimensions: optionalText(values.dimensions),
        leadTimeDays: optionalWholeNumber(values.leadTimeDays, 'The lead time'),
        nonReturnable: checkbox(values.nonReturnable),
        // Whether a figure has been checked against a live product is the
        // difference between a planning band and a quote, and it is the one
        // thing on this form nobody can infer later. It has to be set by the
        // person who looked it up, at the moment they looked it up.
        pricedLive: checkbox(values.pricedLive),
      },
    })

    revalidateProject(option.selection.room.project.slug)
    return { ok: true }
  })
}

export async function saveArtPiece(pieceId: string, values: Values): Promise<Result> {
  return guarded(async () => {
    const piece = await prisma.artPiece.findUnique({
      where: { id: pieceId },
      include: { project: { select: { slug: true } } },
    })
    if (!piece) return { error: 'That piece is not here any more. Refresh the page.' }

    await prisma.artPiece.update({
      where: { id: pieceId },
      data: {
        title: requiredText(values.title, 'The title'),
        artist: optionalText(values.artist),
        sizeLabel: optionalText(values.sizeLabel),
        wallNote: optionalText(values.wallNote),
        photoUrl: optionalUrl(values.photoUrl, 'The photo link'),
        photoCaption: optionalText(values.photoCaption),
      },
    })

    revalidateProject(piece.project.slug)
    return { ok: true }
  })
}
