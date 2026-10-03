import Link from 'next/link'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { projectsForUser } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

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

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <PageHeader
          eyebrow={`Hi ${user.name.split(' ')[0]}`}
          title="Nothing here yet"
          intro="Your project has not been opened up to you yet. Davina will let you know the moment it is, and this page will have it."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-8">
      <PageHeader
        eyebrow={`Hi ${user.name.split(' ')[0]}`}
        title={projects.length === 1 ? 'Your project' : 'Your projects'}
        intro="Click through to see where it stands, what has been picked and what is waiting on you."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} href={`/portal/${project.slug}`} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-tight text-ink">{project.displayName}</h2>
                <p className="mt-0.5 text-sm text-driftwood">{project.community}</p>
              </div>
              <Pill>{project.phase.toLowerCase()}</Pill>
            </div>
            <p className="mt-3 text-sm text-driftwood-deep">
              {project.acSqFt.toLocaleString()} square feet under air
            </p>
          </Card>
        ))}
      </div>

      {user.role === 'DESIGNER' ? (
        <EmptyState>
          You are seeing every project because you are on the design side.{' '}
          <Link href="/admin" className="text-ink underline underline-offset-2">
            Admin
          </Link>{' '}
          has the rest.
        </EmptyState>
      ) : null}
    </div>
  )
}
