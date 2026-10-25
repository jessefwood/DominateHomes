import Link from 'next/link'
import { InviteRole } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { classProgress, COURSES, liveState, type ModuleProgress } from '@/lib/course'
import { courseDate } from '@/lib/course-content'
import { howLongAgo, shortDate } from '@/lib/dates'
import { pendingInvites } from '@/lib/invites'
import { InviteAgentsForm } from './forms'

export const dynamic = 'force-dynamic'

function Cell({ progress }: { progress: ModuleProgress }) {
  if (progress.turnedInAt) {
    return <span className="text-seaglass-deep">✓ {shortDate(progress.turnedInAt)}</span>
  }
  if (progress.answered === 0) return <span className="text-driftwood">·</span>
  return (
    <span className="text-clay-deep">
      {progress.answered}/{progress.total}
    </span>
  )
}

/**
 * The class, for Davina: who is in, who has turned in what, and the way in
 * to teach. Monday's question is "who has not turned in last week", so that
 * is what the grid answers at a glance.
 */
export default async function AdminCoursePage() {
  const course = COURSES[0]
  const [roster, invites, live] = await Promise.all([
    classProgress(course),
    pendingInvites(),
    liveState(course.slug),
  ])
  const agentInvites = invites.filter((invite) => invite.role === InviteRole.AGENT)

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Course"
        title={course.title}
        intro="Your agents, their homework, and the way in to teach. Answers save on their side as they type, so what you see here is current."
        actions={
          <Link
            href={`/learn/${course.slug}`}
            className="hairline rounded-md border px-4 py-2 text-sm text-ink transition-colors hover:bg-oyster"
          >
            Open the course
          </Link>
        }
      />

      {live ? (
        <p className="rounded-lg bg-seaglass-wash px-4 py-3 text-sm text-seaglass-deep">
          You are live on {course.modules.find((m) => m.key === live.moduleKey)?.title}. Agents following along are on
          slide {live.step + 1}.
        </p>
      ) : null}

      <section className="space-y-4">
        <SectionHeading title="Teach" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {course.modules.map((unit) => (
            <Card key={unit.key} href={`/learn/present/${course.slug}/${unit.key}`} className="p-4">
              <p className="eyebrow">
                {unit.number} · {courseDate(unit.date)}
              </p>
              <p className="font-display mt-1 text-lg text-ink">{unit.title}</p>
              <p className="mt-2 text-sm text-seaglass-deep">Present →</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Homework"
          action={
            <span className="space-x-4 text-sm text-driftwood">
              <span className="text-seaglass-deep">✓ turned in</span>
              <span className="text-clay-deep">3/12 answered, not turned in</span>
              <span>· nothing yet</span>
            </span>
          }
        />

        {roster.length === 0 ? (
          <EmptyState>No agents yet. Invite them below and they will show up here as they accept.</EmptyState>
        ) : (
          <div className="hairline overflow-x-auto rounded-xl border bg-page shadow-sheet">
            <table className="w-full text-sm">
              <thead>
                <tr className="hairline border-b text-left text-xs tracking-wider text-driftwood uppercase">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  {course.modules.map((unit) => (
                    <th key={unit.key} className="px-3 py-3 text-center font-medium" title={unit.title}>
                      {unit.number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map(({ agent, modules }) => (
                  <tr key={agent.id} className="hairline border-b last:border-b-0 hover:bg-oyster/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/course/${agent.id}`} className="text-ink underline-offset-2 hover:underline">
                        {agent.name}
                      </Link>
                      {agent.signInEnabled ? null : (
                        <span className="ml-2">
                          <Pill tone="clay">locked out</Pill>
                        </span>
                      )}
                    </td>
                    {course.modules.map((unit) => (
                      <td key={unit.key} className="px-3 py-3 text-center whitespace-nowrap">
                        <Cell progress={modules[unit.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading title="Invite agents" />
        <Card className="p-5">
          <InviteAgentsForm />
        </Card>

        {agentInvites.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-driftwood-deep">Invited, not opened yet:</p>
            <ul className="space-y-1 text-sm text-driftwood-deep">
              {agentInvites.map((invite) => (
                <li key={invite.id}>
                  {invite.name} · {invite.email} · sent {howLongAgo(invite.createdAt)}
                </li>
              ))}
            </ul>
            <p className="text-xs text-driftwood">
              To resend one, invite the same address again; the old link stops working. To withdraw one, use People.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
