import { UploadKind, UploadSource } from '@prisma/client'
import { Uploader } from '@/components/uploader'
import { Card, EmptyState, PageHeader, Pill, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { howLongAgo } from '@/lib/dates'
import { isDesigner, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'
import { storageConfigured } from '@/lib/storage'
import { formatBytes, MAX_UPLOAD_BYTES, uploadsForProject } from '@/lib/uploads'
import { RemoveFile } from './remove-file'

export const dynamic = 'force-dynamic'

/**
 * Files on a project, both directions.
 *
 * Two sections because they answer two different questions. "From Davina" is
 * the drawings and the spec sheets. "What you have sent us" is the eleven
 * photographs of a bare great room with the ceiling height written on one of
 * them, which is the part that is actually hard to get out of a client and
 * the reason this page exists.
 *
 * Previews go through /api/files/<id>, which checks access on every request.
 * There is no address here that works for somebody who is not on the project,
 * so the page can be forwarded to a husband without handing out the files.
 */

type FileRow = Awaited<ReturnType<typeof uploadsForProject>>[number]

const KIND_LABEL: Record<UploadKind, string> = {
  PHOTO: 'Photo',
  VIDEO: 'Video',
  DOCUMENT: 'Document',
  OTHER: 'File',
}

function FileCard({
  file,
  projectSlug,
  canRemove,
}: {
  file: FileRow
  projectSlug: string
  canRemove: boolean
}) {
  const href = `/api/files/${file.id}`

  return (
    <Card className="flex flex-col">
      {file.kind === UploadKind.PHOTO ? (
        <a href={href} target="_blank" rel="noreferrer noopener" className="photo-frame aspect-[4/3] block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={href}
            alt={file.caption ?? file.filename}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </a>
      ) : file.kind === UploadKind.VIDEO ? (
        // Served through the same checked route, so seeking inside a video
        // works the same way a download does: the route redirects to a signed
        // link and the bucket handles the range requests.
        <video src={href} controls preload="metadata" className="aspect-[4/3] w-full bg-ink/90" />
      ) : (
        <div className="hairline flex aspect-[4/3] items-center justify-center border-b bg-oyster/60">
          <span className="px-4 text-center text-sm text-driftwood">{KIND_LABEL[file.kind]}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {file.caption ? (
          <p className="text-sm leading-relaxed text-ink">{file.caption}</p>
        ) : (
          <p className="truncate text-sm text-ink">{file.filename}</p>
        )}

        <p className="mt-1 text-xs text-driftwood">
          {file.room ? `${file.room.name} · ` : ''}
          {file.uploadedBy.name} · {howLongAgo(file.createdAt)} · {formatBytes(file.sizeBytes)}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 pt-1">
          <a
            href={`${href}?download=1`}
            className="text-xs text-driftwood underline underline-offset-2 transition-colors hover:text-ink"
          >
            Download
          </a>
          {canRemove ? (
            <RemoveFile projectSlug={projectSlug} uploadId={file.id} filename={file.filename} />
          ) : null}
        </div>
      </div>
    </Card>
  )
}

export default async function FilesPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)
  const designer = isDesigner(user)

  const [files, rooms] = await Promise.all([
    uploadsForProject(project.id),
    prisma.room.findMany({
      where: { projectId: project.id, tier: { not: 'EXCLUDED' } },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const fromUs = files.filter((file) => file.source === UploadSource.DESIGNER)
  const fromThem = files.filter((file) => file.source === UploadSource.CLIENT)
  const connected = storageConfigured()

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Files"
        title="Photos, videos and paperwork"
        intro={
          designer
            ? 'Everything on this project in both directions. What you put here the client can see, so it is the place for drawings and spec sheets rather than for working files.'
            : 'Anything we have sent you is here, and this is where you send us things. Photos and videos of the rooms as they are now are the most useful thing you can give us, especially with a measurement written next to them.'
        }
      />

      <section className="space-y-4">
        <SectionHeading
          title={designer ? 'Send the client a file' : 'Send us something'}
          action={
            connected ? (
              <span className="text-sm text-driftwood">
                Up to {formatBytes(MAX_UPLOAD_BYTES)} each
              </span>
            ) : null
          }
        />
        <Uploader
          projectSlug={project.slug}
          rooms={rooms}
          disabled={!connected}
          disabledReason="Sending files is not switched on yet. The storage it needs has not been connected, so for now email anything across and Davina will put it on the project."
        />
      </section>

      <section className="space-y-4">
        <SectionHeading title={designer ? 'Sent to the client' : 'From Davina'} />
        {fromUs.length === 0 ? (
          <EmptyState>
            Nothing yet. Drawings, spec sheets and anything else worth keeping will land here.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fromUs.map((file) => (
              <FileCard key={file.id} file={file} projectSlug={project.slug} canRemove={designer} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={designer ? 'From the client' : 'What you have sent us'}
          action={
            fromThem.length > 0 ? <Pill>{fromThem.length} in total</Pill> : null
          }
        />
        {fromThem.length === 0 ? (
          <EmptyState>
            {designer
              ? 'Nothing from the client yet. The three things worth asking for are a video walkthrough of each room, a photograph of every wall that is getting something on it, and the ceiling height.'
              : 'Nothing yet. The three most useful things, in order: a slow video walking through each room, a photo of every wall that is getting something on it, and the ceiling height written in the note.'}
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fromThem.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                projectSlug={project.slug}
                // A client may take back what they sent. A designer may
                // remove anything on a project they run.
                canRemove={designer || file.uploadedById === user.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
