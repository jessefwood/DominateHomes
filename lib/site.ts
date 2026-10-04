import { prisma } from './db'
import { optionalUrl } from './editing'

/**
 * The parts of the public site Davina can change without a deploy.
 *
 * Everything here ends up in front of strangers, so two rules apply that do
 * not apply to the portal:
 *
 * 1. A MISSING VALUE IS A LAYOUT, NOT A GAP. Every setting has a sensible
 *    empty state and the page is designed to look finished without any of
 *    them. A marketing page that only works once six photographs are pasted in
 *    is a page that sits broken for a month.
 *
 * 2. A URL IS CHECKED BEFORE IT IS STORED. These render as `img src`, so the
 *    same protocol check the admin forms use applies here. It is the one that
 *    keeps `javascript:` out.
 */

/** Every setting the site reads, with what it is for. */
export const SITE_KEYS = {
  heroImageUrl: 'The photograph across the top of the home page.',
  heroImageCaption: 'What the top photograph is of. Used as its alt text.',
  davinaPhotoUrl: 'Davina’s photograph, on the who we are section.',
  jessePhotoUrl: 'Jesse’s photograph, on the who we are section.',
  quote: 'Something a client has actually said about working with you.',
  quoteAttribution: 'Who said it, e.g. “Abbie, Port St. Lucie”.',
} as const

export type SiteKey = keyof typeof SITE_KEYS
export type SiteSettings = Record<SiteKey, string>

const EMPTY: SiteSettings = {
  heroImageUrl: '',
  heroImageCaption: '',
  davinaPhotoUrl: '',
  jessePhotoUrl: '',
  quote: '',
  quoteAttribution: '',
}

function isKey(value: string): value is SiteKey {
  return value in SITE_KEYS
}

/**
 * Reads the lot.
 *
 * Falls back to empty rather than throwing when the database is unreachable,
 * because the home page is the one page that has to render regardless. It is
 * what somebody sees when they have been given the company's name, and an
 * error there costs a job.
 */
export async function siteSettings(): Promise<SiteSettings> {
  try {
    const rows = await prisma.siteSetting.findMany()
    const settings = { ...EMPTY }

    for (const row of rows) {
      if (isKey(row.key)) settings[row.key] = row.value
    }

    return settings
  } catch {
    return { ...EMPTY }
  }
}

/**
 * Writes the ones that were sent, leaving the rest alone.
 *
 * Photograph fields go through the same URL check the admin forms use, so a
 * `javascript:` or `data:` URL cannot be stored and then rendered as an image
 * source on the public page.
 */
export async function saveSiteSettings(values: Partial<Record<SiteKey, string>>): Promise<void> {
  const writes = []

  for (const [key, raw] of Object.entries(values)) {
    if (!isKey(key)) continue

    const value = key.endsWith('Url')
      ? (optionalUrl(raw, SITE_KEYS[key]) ?? '')
      : (raw?.trim().slice(0, 600) ?? '')

    writes.push(
      prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    )
  }

  await prisma.$transaction(writes)
}

/**
 * The projects on the public work gallery, newest first.
 *
 * Only ever the photograph, the name, the community and the summary. Nothing
 * from the rooms, nothing from the budget, and nothing about the client. A
 * project with no photograph is left out rather than shown as an empty frame:
 * on a page whose job is to show the work, a missing picture is worse than one
 * fewer project.
 */
export async function showcaseProjects() {
  try {
    return await prisma.project.findMany({
      where: { showOnSite: true, heroImageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        community: true,
        siteSummary: true,
        heroImageUrl: true,
        heroCaption: true,
      },
    })
  } catch {
    return []
  }
}
