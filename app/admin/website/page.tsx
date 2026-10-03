import Link from 'next/link'
import { EditForm } from '@/components/edit-form'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { showcaseProjects, siteSettings } from '@/lib/site'
import { saveWebsite } from './actions'

export const dynamic = 'force-dynamic'

/**
 * The public site, editable.
 *
 * Everything on this screen ends up in front of strangers, which the copy
 * says out loud more than once. It is the one admin screen where a mistake is
 * visible to people who have never met us.
 *
 * Photographs are pasted links, the same as everywhere else in admin, because
 * there is nowhere to upload to until the bucket exists. When it does, these
 * become keys into it and this screen does not change.
 */
export default async function WebsitePage() {
  const [settings, shown, all] = await Promise.all([
    siteSettings(),
    showcaseProjects(),
    prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        displayName: true,
        showOnSite: true,
        heroImageUrl: true,
      },
    }),
  ])

  // Marked for the site but with no photograph, so the gallery skips them.
  // Worth calling out by name: the setting is on, the project is missing, and
  // nothing on screen would otherwise explain why.
  const missingPhoto = all.filter((project) => project.showOnSite && !project.heroImageUrl)

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Website"
        title="The public site"
        intro="Everything on this page is visible to anybody who finds us. No client names, budgets or decisions ever reach it, only what you put here and the projects you have deliberately turned on."
        actions={
          <Link
            href="/"
            className="hairline rounded-lg border px-3.5 py-2 text-sm text-ink transition-colors hover:bg-oyster"
          >
            See the site
          </Link>
        }
      />

      <Card className="p-6">
        <SectionHeading title="Pictures and words" />
        <div className="mt-5">
          <EditForm
            action={saveWebsite}
            fields={[
              {
                name: 'heroImageUrl',
                kind: 'photo',
                label: 'The photograph across the top',
                value: settings.heroImageUrl,
                hint: 'The best finished room you have. Landscape works best. Leave it empty and the top of the site is a headline on white, which also looks right.',
                wide: true,
              },
              {
                name: 'heroImageCaption',
                label: 'What that photograph is of',
                value: settings.heroImageCaption,
                hint: 'Shown under it, and read aloud to anybody using a screen reader.',
                wide: true,
              },
              {
                name: 'davinaPhotoUrl',
                kind: 'photo',
                label: 'Davina’s photograph',
                value: settings.davinaPhotoUrl,
                hint: 'Optional. The section reads fine without one.',
              },
              {
                name: 'jessePhotoUrl',
                kind: 'photo',
                label: 'Jesse’s photograph',
                value: settings.jessePhotoUrl,
                hint: 'Optional.',
              },
              {
                name: 'quote',
                kind: 'textarea',
                label: 'Something a client has said',
                value: settings.quote,
                hint: 'Their actual words, and only with their say so. This stays hidden until there is something here, which is better than an invented one.',
                wide: true,
              },
              {
                name: 'quoteAttribution',
                label: 'Who said it',
                value: settings.quoteAttribution,
                hint: 'How they are happy to be named, for example “Abbie, Port St. Lucie”.',
                wide: true,
              },
            ]}
          />
        </div>
      </Card>

      <section className="space-y-4">
        <SectionHeading
          title="Projects on the site"
          action={<Pill>{shown.length} showing</Pill>}
        />

        <p className="max-w-3xl text-sm leading-relaxed text-driftwood">
          A project is private until you turn it on, and turning it on publishes four things only:
          the photograph, the name, the community and the summary line. Never a room, a price or a
          client&rsquo;s name. Turn one on from its own page, under Projects.
        </p>

        {missingPhoto.length > 0 ? (
          <Card className="bg-clay-wash p-4">
            <p className="text-sm leading-relaxed text-clay-deep">
              {missingPhoto.length === 1
                ? 'This one is turned on but has no photograph, so it is not on the site:'
                : 'These are turned on but have no photograph, so they are not on the site:'}{' '}
              {missingPhoto.map((project, index) => (
                <span key={project.id}>
                  {index > 0 ? ', ' : ''}
                  <Link
                    href={`/admin/projects/${project.slug}`}
                    className="underline underline-offset-2"
                  >
                    {project.displayName}
                  </Link>
                </span>
              ))}
            </p>
          </Card>
        ) : null}

        {all.length === 0 ? (
          <EmptyState>No projects yet.</EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {all.map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4"
              >
                <Link
                  href={`/admin/projects/${project.slug}`}
                  className="min-w-0 text-ink underline-offset-2 hover:underline"
                >
                  {project.displayName}
                </Link>
                {project.showOnSite ? (
                  project.heroImageUrl ? (
                    <Pill tone="sea">On the site</Pill>
                  ) : (
                    <Pill tone="clay">On, but no photograph</Pill>
                  )
                ) : (
                  <Pill>Private</Pill>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
