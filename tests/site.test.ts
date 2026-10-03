import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, beforeEach, describe, it } from 'node:test'
import { Phase } from '@prisma/client'
import { EditError } from '../lib/editing'
import { saveSiteSettings, showcaseProjects, siteSettings } from '../lib/site'
import { prisma, reset } from './helpers'

/**
 * The public site reads from the database now, which means two things can go
 * wrong that could not go wrong when it was a static page.
 *
 *   A PRIVATE PROJECT COULD END UP PUBLIC. `showOnSite` is false by default
 *   and nothing sets it except somebody ticking a box. The tests below say a
 *   project stays off the gallery until it is turned on, and that turning it
 *   on publishes four fields and no more. A client's rooms, prices and
 *   decisions are not in the query at all, which is the strongest version of
 *   that guarantee: they cannot leak from a page that never selects them.
 *
 *   A PASTED LINK COULD CARRY A SCRIPT. These values render as `img src` on a
 *   page strangers load, so the protocol check that guards the admin forms
 *   has to guard this too.
 */

async function makeProject(displayName: string, overrides: Record<string, unknown> = {}) {
  return prisma.project.create({
    data: {
      slug: `p-${randomBytes(4).toString('hex')}`,
      displayName,
      community: 'Valencia Parc at Riverland',
      planName: 'Bianca',
      acSqFt: 2799,
      totalSqFt: 3599,
      phase: Phase.SELECTIONS,
      clientName: 'Abbie Tigges',
      designer: 'Davina Hughes',
      allocationCents: 4_700_000,
      ...overrides,
    },
  })
}

describe('what reaches the public gallery', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('shows nothing until somebody turns a project on', async () => {
    await makeProject('643 Bianca', { heroImageUrl: 'https://example.invalid/a.jpg' })

    // The default is private, and that default is the whole safeguard.
    assert.deepEqual(await showcaseProjects(), [])
  })

  it('shows one that is turned on and has a photograph', async () => {
    await makeProject('643 Bianca', {
      showOnSite: true,
      heroImageUrl: 'https://example.invalid/a.jpg',
      siteSummary: 'A whole house, furnished before they moved in.',
    })

    const shown = await showcaseProjects()
    assert.equal(shown.length, 1)
    assert.equal(shown[0].displayName, '643 Bianca')
    assert.equal(shown[0].siteSummary, 'A whole house, furnished before they moved in.')
  })

  it('leaves out one that is turned on but has no photograph', async () => {
    // Better one fewer project than an empty frame on the page whose entire
    // job is showing the work. The admin screen names these so the setting
    // does not look broken.
    await makeProject('643 Bianca', { showOnSite: true })

    assert.deepEqual(await showcaseProjects(), [])
  })

  it('publishes four fields and nothing else about the project', async () => {
    await makeProject('643 Bianca', {
      showOnSite: true,
      heroImageUrl: 'https://example.invalid/a.jpg',
      allocationCents: 4_700_000,
      designerNote: 'Client is nervous about the sofa price.',
    })

    const [shown] = await showcaseProjects()
    const published = Object.keys(shown).sort()

    // The budget, the client's name and our private notes are not selected,
    // so they cannot reach the page even by accident.
    assert.deepEqual(published, [
      'community',
      'displayName',
      'heroCaption',
      'heroImageUrl',
      'id',
      'siteSummary',
    ])
    assert.ok(!('allocationCents' in shown))
    assert.ok(!('clientName' in shown))
    assert.ok(!('designerNote' in shown))
  })

  it('puts the newest first', async () => {
    const photo = 'https://example.invalid/a.jpg'
    await makeProject('Older', { showOnSite: true, heroImageUrl: photo })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await makeProject('Newer', { showOnSite: true, heroImageUrl: photo })

    const names = (await showcaseProjects()).map((p) => p.displayName)
    assert.deepEqual(names, ['Newer', 'Older'])
  })
})

describe('the site settings', () => {
  beforeEach(reset)
  after(() => prisma.$disconnect())

  it('reads as empty strings before anything is set', async () => {
    const settings = await siteSettings()

    // Every one has to be a string, because the page branches on truthiness.
    // An undefined here would render "undefined" into the markup.
    assert.equal(settings.heroImageUrl, '')
    assert.equal(settings.quote, '')
    assert.equal(typeof settings.davinaPhotoUrl, 'string')
  })

  it('saves and reads back', async () => {
    await saveSiteSettings({
      heroImageUrl: 'https://example.invalid/hero.jpg',
      quote: 'They got the whole house done before we moved in.',
    })

    const settings = await siteSettings()
    assert.equal(settings.heroImageUrl, 'https://example.invalid/hero.jpg')
    assert.equal(settings.quote, 'They got the whole house done before we moved in.')
    assert.equal(settings.quoteAttribution, '')
  })

  it('leaves the ones it was not sent alone', async () => {
    await saveSiteSettings({ heroImageUrl: 'https://example.invalid/hero.jpg' })
    await saveSiteSettings({ quote: 'Something nice' })

    const settings = await siteSettings()
    assert.equal(settings.heroImageUrl, 'https://example.invalid/hero.jpg')
    assert.equal(settings.quote, 'Something nice')
  })

  it('refuses a link that is not http or https', async () => {
    // THE ONE THAT MATTERS. This value becomes an img src on a page that
    // strangers load, so the same protocol check that guards the admin forms
    // has to guard this.
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      await assert.rejects(saveSiteSettings({ heroImageUrl: bad }), EditError, bad)
    }

    // And nothing was stored on the way past.
    assert.equal((await siteSettings()).heroImageUrl, '')
  })

  it('ignores a key the site does not know about', async () => {
    await saveSiteSettings({ notAThing: 'x' } as never)
    assert.equal(await prisma.siteSetting.count(), 0)
  })

  it('caps a quote rather than storing whatever was posted', async () => {
    await saveSiteSettings({ quote: 'x'.repeat(5000) })
    assert.ok((await siteSettings()).quote.length <= 600)
  })
})
