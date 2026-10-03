import Link from 'next/link'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { dateAndTime, howLongAgo } from '@/lib/dates'
import { stillRestorable, TRASH_DAYS, trashedFiles, trashedMessages } from '@/lib/trash'
import { formatBytes } from '@/lib/uploads'
import { Restore } from './restore'

export const dynamic = 'force-dynamic'

/**
 * What has been removed, and the fact that it has not gone anywhere.
 *
 * Split into "still in the 30 days" and "older than that" purely so the
 * recent things are not buried. Both are restorable: the window decides what
 * is shown first, not what is possible. Nothing on this screen is ever
 * cleared out automatically.
 */
export default async function TrashPage() {
  const [files, messages] = await Promise.all([trashedFiles(), trashedMessages()])
  const now = new Date()

  const recentFiles = files.filter((file) => stillRestorable(file, now))
  const olderFiles = files.filter((file) => !stillRestorable(file, now))

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Trash"
        title="Removed, but still here"
        intro={`Nothing in the portal is permanently deleted. Removing a file or a message sets a date on it, and the file itself stays in storage. The ${TRASH_DAYS} days decide what shows up at the top of this page, not what can be put back, and nothing on here is ever cleared out on a timer.`}
      />

      <section className="space-y-4">
        <SectionHeading
          title={`Files removed in the last ${TRASH_DAYS} days`}
          action={recentFiles.length > 0 ? <Pill>{recentFiles.length}</Pill> : null}
        />

        {recentFiles.length === 0 ? (
          <EmptyState>Nothing recent.</EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {recentFiles.map((file) => (
              <div key={file.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{file.filename}</p>
                  <p className="mt-0.5 text-sm text-driftwood">
                    <Link
                      href={`/admin/projects/${file.project.slug}`}
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      {file.project.displayName}
                    </Link>{' '}
                    · sent by {file.uploadedBy.name} · {formatBytes(file.sizeBytes)}
                  </p>
                  <p className="mt-0.5 text-sm text-driftwood">
                    Removed {file.deletedBy ? `by ${file.deletedBy.name} ` : ''}
                    {file.deletedAt ? howLongAgo(file.deletedAt, now).toLowerCase() : ''}
                  </p>
                </div>
                <Restore id={file.id} kind="file" />
              </div>
            ))}
          </Card>
        )}
      </section>

      {olderFiles.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading
            title={`Files removed more than ${TRASH_DAYS} days ago`}
            action={<Pill>{olderFiles.length}</Pill>}
          />
          <Card className="divide-y divide-ink/10">
            {olderFiles.map((file) => (
              <div key={file.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{file.filename}</p>
                  <p className="mt-0.5 text-sm text-driftwood">
                    {file.project.displayName} · sent by {file.uploadedBy.name} ·{' '}
                    {file.deletedAt ? `removed ${dateAndTime(file.deletedAt)}` : ''}
                  </p>
                </div>
                <Restore id={file.id} kind="file" />
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          title="Messages taken back"
          action={messages.length > 0 ? <Pill>{messages.length}</Pill> : null}
        />

        {messages.length === 0 ? (
          <EmptyState>None.</EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-driftwood-deep">
                  {message.body.length > 400 ? `${message.body.slice(0, 400)}…` : message.body}
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <p className="text-sm text-driftwood">
                    {message.author.name} · {message.project.displayName} ·{' '}
                    {message.deletedAt ? `removed ${dateAndTime(message.deletedAt)}` : ''}
                  </p>
                  <Restore id={message.id} kind="message" />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
