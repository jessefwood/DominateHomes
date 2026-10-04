import Link from 'next/link'
import { AccessRequestStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { pendingAccessRequests } from '@/lib/access-requests'
import { configuredAdminEmails } from '@/lib/admins'
import { prisma } from '@/lib/db'
import { dateAndTime, howLongAgo } from '@/lib/dates'
import { pendingInvites } from '@/lib/invites'
import { InviteForm, RequestRow, WithdrawInvite } from './forms'

export const dynamic = 'force-dynamic'

/**
 * Who is in, who has been asked in, and who has asked to be.
 *
 * Three sections in the order the work actually happens: deal with the people
 * waiting on you, then invite the ones you meant to, then check on the
 * invitations already out.
 *
 * The list of existing accounts is deliberately still on the overview screen
 * rather than moved here. It is the thing Davina looks at most and it has
 * been in that spot since the start.
 */
export default async function PeoplePage() {
  const [requests, invites, projects, handled] = await Promise.all([
    pendingAccessRequests(),
    pendingInvites(),
    prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, displayName: true },
    }),
    prisma.accessRequest.findMany({
      where: { status: { not: AccessRequestStatus.PENDING } },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
      include: { reviewedBy: { select: { name: true } } },
    }),
  ])

  const configured = configuredAdminEmails()

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="People"
        title="Letting people in"
        intro="Nobody can sign themselves up. An account only comes into being one of two ways: you invite someone, or you approve someone who asked. Both end with you."
      />

      <section className="space-y-4">
        <SectionHeading
          title="Waiting on you"
          action={requests.length > 0 ? <Pill tone="clay">{requests.length}</Pill> : null}
        />

        {requests.length === 0 ? (
          <EmptyState>
            Nothing waiting. Requests from the{' '}
            <Link href="/request-access" className="text-ink underline underline-offset-2">
              public form
            </Link>{' '}
            land here, and you get an email when one does.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id} className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-ink">{request.name}</p>
                    <p className="mt-0.5 text-sm text-driftwood">
                      {request.email}
                      {request.phone ? ` · ${request.phone}` : ''}
                    </p>
                  </div>
                  <span className="text-sm text-driftwood">{howLongAgo(request.createdAt)}</span>
                </div>

                {request.note ? (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-driftwood-deep">
                    {request.note}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-driftwood">They did not leave a note.</p>
                )}

                <div className="hairline mt-4 border-t pt-4">
                  <RequestRow requestId={request.id} projects={projects} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading title="Invite a client" />
        <Card className="p-5">
          <InviteForm projects={projects} />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Invitations out"
          action={invites.length > 0 ? <Pill>{invites.length}</Pill> : null}
        />

        {invites.length === 0 ? (
          <EmptyState>
            No invitations outstanding. One that is accepted or withdrawn drops off this list.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {invites.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{entry.name}</p>
                  <p className="mt-0.5 text-sm text-driftwood">
                    {entry.email}
                    {entry.project ? ` · ${entry.project.displayName}` : ' · no project yet'}
                  </p>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm text-driftwood">
                    Runs out {dateAndTime(entry.expiresAt)}
                  </span>
                  <WithdrawInvite inviteId={entry.id} email={entry.email} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {handled.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading title="Already dealt with" />
          <Card className="divide-y divide-ink/10">
            {handled.map((request) => (
              <div key={request.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {request.name} <span className="text-driftwood">{request.email}</span>
                  </p>
                  {request.reviewNote ? (
                    <p className="mt-0.5 text-sm text-driftwood">{request.reviewNote}</p>
                  ) : null}
                </div>
                <p className="text-sm text-driftwood">
                  {request.status === AccessRequestStatus.APPROVED ? 'Approved' : 'Declined'}
                  {request.reviewedBy ? ` by ${request.reviewedBy.name}` : ''}
                  {request.reviewedAt ? ` · ${dateAndTime(request.reviewedAt)}` : ''}
                </p>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading title="The way back in" />
        <Card className="p-5">
          {configured.length === 0 ? (
            <>
              <p className="text-sm leading-relaxed text-driftwood-deep">
                Nothing is set in <span className="text-ink">ADMIN_EMAILS</span>. Worth setting.
                There is no password on this portal and no self-signup, so if both of your accounts
                were switched off by accident the only way back in would be a database session.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-driftwood">
                Put both of your addresses in that variable in the Railway settings, separated by a
                comma. An address on it can always get a sign-in link, and gets a designer account
                whether or not one exists. It only ever adds access, never removes it.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-driftwood-deep">
                These addresses can always get back in, set in{' '}
                <span className="text-ink">ADMIN_EMAILS</span> in the hosting settings rather than
                here, so that losing access to this screen does not lose you the portal.
              </p>
              <ul className="mt-3 space-y-1">
                {configured.map((email) => (
                  <li key={email} className="text-sm text-ink">
                    {email}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>
    </div>
  )
}
