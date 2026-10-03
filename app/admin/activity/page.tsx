import Link from 'next/link'
import { AuditAction } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { ACTIVITY_DAYS, AUDIT_LABEL } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { dateAndTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * The record of what happened.
 *
 * Shows the stored summary line as it was written at the time rather than
 * rebuilding a sentence from the columns. Names change, accounts get closed,
 * projects get renamed, and a log that re-renders itself from live data stops
 * being a record of what happened and becomes a view of what is true now.
 *
 * Filterable by what kind of thing it was, because the two questions anybody
 * actually brings to a log are "who let them in" and "who removed that file",
 * and those are a long way apart in a single list.
 */

/** The groups the filter offers, and what each one covers. */
const GROUPS: { key: string; label: string; actions: AuditAction[] }[] = [
  {
    key: 'access',
    label: 'Getting in',
    actions: [
      AuditAction.SIGN_IN_REQUESTED,
      AuditAction.SIGNED_IN,
      AuditAction.SIGNED_OUT,
      AuditAction.ACCESS_OPENED,
      AuditAction.ACCESS_CLOSED,
    ],
  },
  {
    key: 'invites',
    label: 'Being let in',
    actions: [
      AuditAction.INVITE_SENT,
      AuditAction.INVITE_ACCEPTED,
      AuditAction.INVITE_REVOKED,
      AuditAction.ACCESS_REQUESTED,
      AuditAction.ACCESS_APPROVED,
      AuditAction.ACCESS_DECLINED,
    ],
  },
  {
    key: 'files',
    label: 'Files',
    actions: [AuditAction.FILE_UPLOADED, AuditAction.FILE_DELETED, AuditAction.FILE_RESTORED],
  },
  { key: 'messages', label: 'Messages', actions: [AuditAction.MESSAGE_SENT] },
]

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>
}) {
  const { show } = await searchParams
  const group = GROUPS.find((entry) => entry.key === show)

  const since = new Date(Date.now() - ACTIVITY_DAYS * 86_400_000)

  const events = await prisma.auditEvent.findMany({
    where: {
      createdAt: { gte: since },
      ...(group ? { action: { in: group.actions } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { project: { select: { displayName: true, slug: true } } },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Activity"
        title="What has happened"
        intro={`Signing in, being let in, and anything that moves or removes a client's file. Deliberately not every change: a log that records everything is a log nobody reads. The last ${ACTIVITY_DAYS} days.`}
      />

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/admin/activity"
          aria-current={group ? undefined : 'page'}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            group ? 'text-driftwood-deep hover:bg-oyster' : 'bg-oyster font-medium text-ink'
          }`}
        >
          Everything
        </Link>
        {GROUPS.map((entry) => (
          <Link
            key={entry.key}
            href={`/admin/activity?show=${entry.key}`}
            aria-current={group?.key === entry.key ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              group?.key === entry.key
                ? 'bg-oyster font-medium text-ink'
                : 'text-driftwood-deep hover:bg-oyster'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <SectionHeading
          title={group ? group.label : 'Everything'}
          action={events.length > 0 ? <Pill>{events.length}</Pill> : null}
        />

        {events.length === 0 ? (
          <EmptyState>
            Nothing recorded in that stretch. This starts filling up the first time somebody signs
            in, is invited, or sends a file.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {events.map((event) => (
              <div key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-ink">{event.summary}</p>
                  <p className="mt-0.5 text-sm text-driftwood">
                    {AUDIT_LABEL[event.action]}
                    {event.project ? (
                      <>
                        {' · '}
                        <Link
                          href={`/admin/projects/${event.project.slug}`}
                          className="underline underline-offset-2 hover:text-ink"
                        >
                          {event.project.displayName}
                        </Link>
                      </>
                    ) : null}
                    {event.actorEmail && !event.summary.includes(event.actorEmail)
                      ? ` · ${event.actorEmail}`
                      : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-driftwood">{dateAndTime(event.createdAt)}</p>
              </div>
            ))}
          </Card>
        )}

        {events.length === 300 ? (
          <p className="text-sm leading-relaxed text-driftwood">
            Showing the most recent 300. Narrow it with the filters above to see further back.
          </p>
        ) : null}
      </section>
    </div>
  )
}
