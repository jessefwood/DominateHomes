'use server'

import { revalidatePath } from 'next/cache'
import { EditError } from '@/lib/editing'
import { requireDesigner } from '@/lib/session'
import { saveSiteSettings, type SiteKey } from '@/lib/site'

type Result = { error?: string; ok?: true; note?: string }

/**
 * Saving the public site's pictures and words.
 *
 * Designer only, checked here rather than relying on the admin layout: a
 * server action is a public endpoint and this one writes straight to the page
 * strangers see.
 */
export async function saveWebsite(values: Partial<Record<SiteKey, string>>): Promise<Result> {
  await requireDesigner()

  try {
    await saveSiteSettings(values)
  } catch (error) {
    // optionalUrl throws this for a link that is not http or https, which is
    // the check that keeps a javascript: URL out of an img src on the public
    // page.
    if (error instanceof EditError) return { error: error.message }
    throw error
  }

  revalidatePath('/')
  revalidatePath('/admin/website')
  return { ok: true, note: 'Saved. Open the site to see it.' }
}
