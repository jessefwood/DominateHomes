import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phase } from '@prisma/client'
import { EditForm } from '@/components/edit-form'
import { Card, PageHeader, Photo, PhotoMissing, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { saveArtPiece, saveProject } from '../actions'

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
            ]}
          />
        </div>
      </Card>

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
