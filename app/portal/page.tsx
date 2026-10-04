import Link from 'next/link'
import { AccountMenu } from '@/components/account-menu'
import { Logomark } from '@/components/logo'
import { Card, EmptyState, PageHeader, Photo, PhotoMissing, Pill } from '@/components/ui'
import { isDesigner, projectsForUser } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import type { User } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * The top bar for the list.
 *
 * Every other signed-in screen gets one from a layout, and this page sits
 * above all of those, so it had none at all: you signed in, landed here, and
 * there was no way to sign out and no way back to the site.
 *
 * Deliberately not written as app/portal/layout.tsx. A layout at this level
 * wraps the project pages too, and those already have their own header, so it
 * would give every project screen two stacked bars.
 */
function TopBar({ user }: { user: User }) {
  return (
    <header className="hairline sticky top-0 z-40 border-b bg-page/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          title="The Dominate Homes site"
        >
          <Logomark className="w-7 shrink-0 text-ink" title="Dominate Homes" />
          <span className="hidden text-[11px] leading-tight tracking-[0.18em] text-driftwood uppercase sm:block">
            Dominate
            <br />
            Homes
          </span>
        </Link>

        <div className="flex-1" />

        <AccountMenu name={user.name} email={user.email} isDesigner={isDesigner(user)} />
      </div>
    </header>
  )
}

/**
 * What you land on after signing in: the projects this account is attached to.
 *
 * This used to pass straight through to the project when there was only one,
 * on the reasoning that a list of one is a page in the way. That was wrong in
 * practice. Signing in and arriving inside a project gives no sense of where
 * you are or that there is anything above it, and the first thing both of us
 * asked for was to see the list and click into it. So the list always shows,
 * at one project and at ten.
 */
export default async function PortalIndex() {
  const user = await requireUser()
  const projects = await projectsForUser(user)
  const designer = isDesigner(user)

  if (projects.length === 0) {
    return (
      <div className="min-h-screen">
        <TopBar user={user} />
        <div className="mx-auto max-w-2xl px-4 py-16">
          <PageHeader
            eyebrow={`Hi ${user.name.split(' ')[0]}`}
            title="Nothing here yet"
            intro="Your project has not been opened up to you yet. Davina will let you know the moment it is, and this page will have it."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <TopBar user={user} />

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-8">
        <PageHeader
          eyebrow={`Hi ${user.name.split(' ')[0]}`}
          title={
            designer
              ? 'Every project'
              : projects.length === 1
                ? 'Your project'
                : 'Your projects'
          }
          intro={
            designer
              ? 'Every project on the books, as the client sees it. Open one to read it their way, or edit it in admin.'
              : projects.length === 1
                ? 'Click through to see where it stands, what has been picked and what is waiting on you.'
                : 'Open whichever one you want. Each has its own rooms, budget and decisions.'
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} href={`/portal/${project.slug}`}>
              {project.heroImageUrl ? (
                <Photo
                  src={project.heroImageUrl}
                  alt={project.displayName}
                  aspect="aspect-[16/9]"
                  className="rounded-none"
                />
              ) : (
                <PhotoMissing aspect="aspect-[16/9]" className="rounded-none border-0 border-b" />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg leading-tight text-ink">
                      {project.displayName}
                    </h2>
                    <p className="mt-0.5 text-sm text-driftwood">{project.community}</p>
                  </div>
                  <Pill>{project.phase.toLowerCase()}</Pill>
                </div>
                <p className="mt-3 text-sm text-driftwood-deep">
                  {project.acSqFt.toLocaleString()} square feet under air
                </p>
              </div>
            </Card>
          ))}
        </div>

        {designer ? (
          <EmptyState>
            You are seeing every project because you are on the design side.{' '}
            <Link href="/admin" className="text-ink underline underline-offset-2">
              Admin
            </Link>{' '}
            has the rest.
          </EmptyState>
        ) : null}
      </div>
    </div>
  )
}
