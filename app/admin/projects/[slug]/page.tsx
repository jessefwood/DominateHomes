import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phase } from '@prisma/client'
import { EditForm } from '@/components/edit-form'
import { OpenItemOwner, OpenItemStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Photo, PhotoMissing, Pill, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { openItemsFor } from '@/lib/open-items'
import { saveArtPiece, saveProject } from '../actions'
import { AskClient, ItemState } from './asks'

export const dynamic = 'force-dynamic'

const PHASE_OPTIONS = Object.values(Phase).map((phase) => ({
  value: phase,
  label: phase.charAt(0) + phase.slice(1).toLowerCase(),
}))

export default async function EditProject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      rooms: {
        orderBy: { order: 'asc' },
        include: { _count: { select: { selections: true } } },
      },
      artPieces: { orderBy: [{ decision: 'asc' }, { title: 'asc' }] },
    },
  })

  if (!project) notFound()

  const openItems = await openItemsFor(project.id)
  const askedOfHer = openItems.filter(
    (item) => item.owner === OpenItemOwner.CLIENT && item.status === OpenItemStatus.OPEN,
  )
  const answered = openItems.filter((item) => item.status !== OpenItemStatus.OPEN)
  const ourOwn = openItems.filter(
    (item) => item.owner === OpenItemOwner.DESIGNER && item.status === OpenItemStatus.OPEN,
  )

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Project"
        title={project.displayName}
        intro="Everything here is what the client reads, so it is worth the second look. Nothing saves until you press Save."
        actions={
          <Link
            href={`/portal/${project.slug}`}
            className="hairline rounded-lg border px-3.5 py-2 text-sm text-ink transition-colors hover:bg-oyster"
          >
            See the client&rsquo;s view
          </Link>
        }
      />

      <Card className="p-6">
        <SectionHeading title="The project" />
        <div className="mt-5">
          <EditForm
            action={saveProject.bind(null, project.id)}
            fields={[
              {
                name: 'displayName',
                label: 'Name',
                value: project.displayName,
                hint: 'Projects go by street number and street name once there is one. Until then, the builder plan name.',
                wide: true,
              },
              {
                name: 'addressLine',
                label: 'Street address',
                value: project.addressLine ?? '',
                placeholder: 'Not assigned yet',
                hint: 'Leave empty until GL Homes assigns a lot number. Do not put a guess here.',
                wide: true,
              },
              { name: 'community', label: 'Community', value: project.community },
              { name: 'clientName', label: 'Client', value: project.clientName },
              {
                name: 'phase',
                label: 'Phase',
                value: project.phase,
                kind: 'select',
                options: PHASE_OPTIONS,
                hint: 'Drives the "right now" line on the client dashboard.',
              },
              {
                name: 'heroImageUrl',
                label: 'Photograph',
                value: project.heroImageUrl ?? '',
                kind: 'photo',
                placeholder: 'https://',
                wide: true,
              },
              {
                name: 'heroCaption',
                label: 'Caption under the photograph',
                value: project.heroCaption ?? '',
                placeholder: 'Optional',
                wide: true,
              },
              {
                name: 'designerNote',
                label: 'Your own notes',
                value: project.designerNote ?? '',
                kind: 'textarea',
                hint: 'Only you and Jesse see this. It is never shown to the client.',
                wide: true,
              },
              {
                name: 'showOnSite',
                kind: 'checkbox',
                label: 'Show this project on the public website',
                value: project.showOnSite ? 'on' : '',
                hint: 'Off unless you turn it on. It publishes four things and no more: the photograph above, the name, the community and the summary below. Never a room, a price, or the client’s name. Ask the client first.',
                wide: true,
              },
              {
                name: 'siteSummary',
                kind: 'textarea',
                label: 'Summary for the website',
                value: project.siteSummary ?? '',
                hint: 'A line or two for a stranger rather than for the client. Shown under the photograph in the work gallery.',
                wide: true,
              },
            ]}
          />
        </div>
      </Card>

      {/* ---------------------------------------------------------------
          Talking to the client. This is the part that was missing: open
          items drove two numbers on her dashboard and could be answered, but
          nothing anywhere could create one, so asking her something meant a
          text message and an answer that lived in a phone.
          --------------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeading
          title="Ask the client something"
          action={
            <Link
              href={`/portal/${project.slug}/messages`}
              className="text-sm text-driftwood hover:text-ink"
            >
              Or message them
            </Link>
          }
        />

        <Card className="p-5">
          <AskClient slug={project.slug} />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Waiting on the client"
          action={
            askedOfHer.length > 0 ? (
              <Pill tone="clay">{askedOfHer.length}</Pill>
            ) : (
              <span className="text-sm text-driftwood">Nothing outstanding</span>
            )
          }
        />

        {askedOfHer.length === 0 ? (
          <EmptyState>
            Nothing is waiting on them. Anything you ask above shows up here until it is answered.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-ink/10">
            {askedOfHer.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 font-medium text-ink">{item.title}</p>
                  {item.blocksOrdering ? <Pill tone="clay">Holds up ordering</Pill> : null}
                </div>
                {item.detail ? (
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-driftwood-deep">
                    {item.detail}
                  </p>
                ) : null}
                <div className="mt-2">
                  <ItemState slug={project.slug} itemId={item.id} closed={false} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {ourOwn.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading title="Waiting on us" action={<Pill>{ourOwn.length}</Pill>} />
          <Card className="divide-y divide-ink/10">
            {ourOwn.map((item) => (
              <div key={item.id} className="p-4">
                <p className="font-medium text-ink">{item.title}</p>
                {item.detail ? (
                  <p className="mt-1 text-sm leading-relaxed text-driftwood-deep">{item.detail}</p>
                ) : null}
                <div className="mt-2">
                  <ItemState slug={project.slug} itemId={item.id} closed={false} />
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {answered.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading title="Answered and closed" action={<Pill>{answered.length}</Pill>} />
          <Card className="divide-y divide-ink/10">
            {answered.map((item) => (
              <div key={item.id} className="p-4">
                <p className="text-sm text-ink">{item.title}</p>
                {item.answer ? (
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-driftwood-deep">
                    &ldquo;{item.answer}&rdquo;
                    {item.answeredBy ? (
                      <span className="text-driftwood"> &middot; {item.answeredBy.name}</span>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-2">
                  <ItemState
                    slug={project.slug}
                    itemId={item.id}
                    closed={item.status === OpenItemStatus.CLOSED}
                  />
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          title="Rooms"
          action={<span className="text-sm text-driftwood">{project.rooms.length} rooms</span>}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {project.rooms.map((room) => (
            <Card key={room.id} href={`/admin/projects/${project.slug}/rooms/${room.slug}`}>
              {room.photoUrl ? (
                <Photo src={room.photoUrl} alt={room.name} className="rounded-none" />
              ) : (
                <PhotoMissing className="rounded-none border-0 border-b">Add a photo</PhotoMissing>
              )}
              <div className="p-4">
                <p className="font-display text-base leading-tight text-ink">{room.name}</p>
                <p className="mt-1 text-sm text-driftwood">
                  {room._count.selections} pieces · {room.tier.toLowerCase()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Art"
          action={<span className="text-sm text-driftwood">{project.artPieces.length} pieces</span>}
        />

        <p className="max-w-2xl text-sm leading-relaxed text-driftwood">
          A list of art with no pictures on it is close to useless to the person deciding, so this is
          the screen worth the half hour.
        </p>

        <div className="space-y-5">
          {project.artPieces.map((piece) => (
            <Card key={piece.id} className="p-6">
              <SectionHeading title={piece.title} />
              <div className="mt-5">
                <EditForm
                  action={saveArtPiece.bind(null, piece.id)}
                  fields={[
                    { name: 'title', label: 'Title', value: piece.title },
                    { name: 'artist', label: 'Artist', value: piece.artist ?? '' },
                    {
                      name: 'sizeLabel',
                      label: 'Size',
                      value: piece.sizeLabel ?? '',
                      placeholder: 'e.g. 40 by 60 inches framed',
                    },
                    {
                      name: 'photoCaption',
                      label: 'Caption',
                      value: piece.photoCaption ?? '',
                      placeholder: 'Optional',
                    },
                    {
                      name: 'photoUrl',
                      label: 'Photograph',
                      value: piece.photoUrl ?? '',
                      kind: 'photo',
                      placeholder: 'https://',
                      wide: true,
                    },
                    {
                      name: 'wallNote',
                      label: 'Where it goes',
                      value: piece.wallNote ?? '',
                      kind: 'textarea',
                      wide: true,
                    },
                  ]}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
