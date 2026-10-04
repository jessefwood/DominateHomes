import { Role } from '@prisma/client'
import { EmptyState, PageHeader } from '@/components/ui'
import { dateAndTime, howLongAgo } from '@/lib/dates'
import { MAX_MESSAGE_LENGTH, markThreadRead, messagesForProject } from '@/lib/messages'
import { isDesigner, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import { Composer, RemoveMessage } from './thread'

export const dynamic = 'force-dynamic'

/**
 * One thread per project, both designers on one side of it.
 *
 * Opening the page marks it read, which is why this is force-dynamic and why
 * the write happens before the list is drawn: otherwise the page you are
 * looking at still shows its own messages as unread.
 *
 * Bodies are rendered as text with `whitespace-pre-wrap`. Line breaks survive
 * and nothing else is interpreted. No markdown, no link detection, no HTML.
 */
export default async function MessagesPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)
  const viewerIsDesigner = isDesigner(user)

  await markThreadRead(user, project.id)
  const messages = await messagesForProject(project.id)

  return (
    <div className="flex min-h-[70vh] flex-col">
      <PageHeader
        eyebrow="Messages"
        title={viewerIsDesigner ? 'The thread on this project' : 'Talk to us'}
        intro={
          viewerIsDesigner
            ? 'Everything said about this house in one place. Both of you see this thread and either of you can answer it, so the client never has to work out which of you to tell.'
            : 'Anything about the house, in one place. Davina and Jesse both see this, so you only have to say it once. It is better than a text message because it is still here in four months when somebody asks what was decided.'
        }
      />

      <div className="mt-8 flex-1 space-y-5">
        {messages.length === 0 ? (
          <EmptyState>
            Nothing here yet. Questions, measurements, a photo you want to talk about, or something
            you have changed your mind about are all fair game.
          </EmptyState>
        ) : (
          messages.map((message) => {
            const mine = message.authorId === user.id
            const fromDesignSide = message.author.role === Role.DESIGNER

            return (
              <div
                key={message.id}
                className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[46rem] rounded-xl px-4 py-3 ${
                    mine
                      ? 'bg-ink text-page'
                      : fromDesignSide
                        ? 'hairline border bg-seaglass-wash text-ink'
                        : 'hairline border bg-oyster text-ink'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.body}</p>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-3 px-1">
                  <span className="text-xs text-driftwood" title={dateAndTime(message.createdAt)}>
                    {mine ? 'You' : message.author.name} · {howLongAgo(message.createdAt)}
                  </span>

                  {mine || viewerIsDesigner ? (
                    <RemoveMessage projectSlug={project.slug} messageId={message.id} />
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Composer projectSlug={project.slug} maxLength={MAX_MESSAGE_LENGTH} />
    </div>
  )
}
