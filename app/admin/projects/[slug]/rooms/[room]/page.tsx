import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EditForm } from '@/components/edit-form'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { centsToInput } from '@/lib/editing'
import { saveOption, saveRoom, saveSelection } from '../../../actions'

export const dynamic = 'force-dynamic'

/**
 * One room, and everything in it, on one page.
 *
 * Deliberately not a room page that links out to a piece page that links out
 * to an option page. Davina works a room at a time: she has the three options
 * for a piece open in other tabs and is pasting prices and pictures in. Three
 * clicks between each paste is the difference between this being used and not.
 */
export default async function EditRoom({
  params,
}: {
  params: Promise<{ slug: string; room: string }>
}) {
  const { slug, room: roomSlug } = await params

  const project = await prisma.project.findUnique({ where: { slug } })
  if (!project) notFound()

  const room = await prisma.room.findUnique({
    where: { projectId_slug: { projectId: project.id, slug: roomSlug } },
    include: {
      selections: {
        orderBy: { ref: 'asc' },
        include: { options: { orderBy: { slot: 'asc' } } },
      },
    },
  })

  if (!room) notFound()

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={project.displayName}
        title={room.name}
        intro="The photographs and prices here are what the client compares. A price is only a quote once you have checked it against the live product and ticked the box that says so."
        actions={
          <Link
            href={`/admin/projects/${project.slug}`}
            className="hairline rounded-lg border px-3.5 py-2 text-sm text-ink transition-colors hover:bg-oyster"
          >
            All rooms
          </Link>
        }
      />

      <Card className="p-6">
        <SectionHeading title="The room" />
        <div className="mt-5">
          <EditForm
            action={saveRoom.bind(null, room.id)}
            fields={[
              { name: 'name', label: 'Name', value: room.name },
              {
                name: 'photoCaption',
                label: 'Caption under the photograph',
                value: room.photoCaption ?? '',
                placeholder: 'Optional',
              },
              {
                name: 'photoUrl',
                label: 'Photograph',
                value: room.photoUrl ?? '',
                kind: 'photo',
                placeholder: 'https://',
                wide: true,
              },
              {
                name: 'contents',
                label: 'What is going in here',
                value: room.contents,
                kind: 'textarea',
                wide: true,
              },
              {
                name: 'constraintNote',
                label: 'Anything that limits the choice',
                value: room.constraintNote ?? '',
                kind: 'textarea',
                hint: 'Ceiling height, a window that eats the wall, a door swing. The client reads this.',
                wide: true,
              },
              {
                name: 'unresolvedNote',
                label: 'Still unresolved',
                value: room.unresolvedNote ?? '',
                kind: 'textarea',
                hint: 'Shown to the client as an open question, so write it as one.',
                wide: true,
              },
            ]}
          />
        </div>
      </Card>

      <section className="space-y-5">
        <SectionHeading
          title="Pieces"
          action={<span className="text-sm text-driftwood">{room.selections.length} in this room</span>}
        />

        {room.selections.length === 0 ? (
          <EmptyState>
            Nothing in this room yet. Pieces come from the room schedule in the source documents when
            the project is seeded.
          </EmptyState>
        ) : null}

        {room.selections.map((selection) => (
          <Card key={selection.id} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h3 className="font-display text-lg text-ink">{selection.name}</h3>
                <p className="mt-0.5 text-sm text-driftwood">
                  {selection.ref} · {selection.category}
                </p>
              </div>
              <Pill tone={selection.chosenSlot ? 'sea' : 'neutral'}>
                {selection.chosenSlot ? `Option ${selection.chosenSlot} chosen` : 'Not picked yet'}
              </Pill>
            </div>

            <div className="mt-5">
              <EditForm
                action={saveSelection.bind(null, selection.id)}
                fields={[
                  { name: 'name', label: 'Name', value: selection.name },
                  { name: 'category', label: 'Category', value: selection.category },
                  { name: 'qty', label: 'How many', value: String(selection.qty) },
                  {
                    name: 'notes',
                    label: 'Note',
                    value: selection.notes ?? '',
                    hint: 'A line the client sees next to the piece.',
                  },
                  {
                    name: 'plannedLow',
                    label: 'Planning band, low',
                    value: centsToInput(selection.plannedLowCents),
                    kind: 'money',
                    placeholder: '0.00',
                  },
                  {
                    name: 'plannedHigh',
                    label: 'Planning band, high',
                    value: centsToInput(selection.plannedHighCents),
                    kind: 'money',
                    placeholder: '0.00',
                  },
                ]}
              />
            </div>

            <div className="hairline mt-7 space-y-6 border-t pt-6">
              <p className="text-xs tracking-wide text-driftwood uppercase">
                Options ({selection.options.length} of 3)
              </p>

              {selection.options.map((option) => (
                <div key={option.id} className="rounded-xl bg-oyster/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">Option {option.slot}</p>
                    <div className="flex items-center gap-2">
                      {option.pricedLive ? <Pill tone="sea">Priced live</Pill> : <Pill>Planning band</Pill>}
                      {option.nonReturnable ? <Pill tone="clay">No returns</Pill> : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <EditForm
                      action={saveOption.bind(null, option.id)}
                      fields={[
                        { name: 'label', label: 'What it is', value: option.label },
                        { name: 'vendor', label: 'Vendor', value: option.vendor },
                        {
                          name: 'price',
                          label: 'Price',
                          value: centsToInput(option.priceCents),
                          kind: 'money',
                          placeholder: '0.00',
                        },
                        { name: 'colorway', label: 'Colour', value: option.colorway ?? '' },
                        { name: 'dimensions', label: 'Dimensions', value: option.dimensions ?? '' },
                        {
                          name: 'leadTimeDays',
                          label: 'Lead time in days',
                          value: option.leadTimeDays === null ? '' : String(option.leadTimeDays),
                        },
                        {
                          name: 'photoUrl',
                          label: 'Photograph',
                          value: option.photoUrl ?? '',
                          kind: 'photo',
                          placeholder: 'https://',
                          wide: true,
                        },
                        {
                          name: 'productUrl',
                          label: 'Link to the product page',
                          value: option.productUrl ?? '',
                          placeholder: 'https://',
                          wide: true,
                        },
                        {
                          name: 'pricedLive',
                          label: 'Priced against the live product',
                          value: option.pricedLive ? 'yes' : '',
                          kind: 'checkbox',
                          hint: 'Yes, I have just checked this price on the vendor site',
                        },
                        {
                          name: 'nonReturnable',
                          label: 'Non returnable',
                          value: option.nonReturnable ? 'yes' : '',
                          kind: 'checkbox',
                          hint: 'Yes, this one cannot be sent back',
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}

              {selection.options.length < 3 ? (
                <EmptyState>
                  This piece has {selection.options.length} of its three options. The three option
                  limit is a maximum, not a target, but fewer than three is usually one still to find.
                </EmptyState>
              ) : null}
            </div>
          </Card>
        ))}
      </section>
    </div>
  )
}
