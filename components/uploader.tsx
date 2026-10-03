'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runAction } from '@/lib/client-action'
import { finishUpload, requestUpload } from '@/app/portal/[project]/files/actions'

/**
 * Sending files.
 *
 * Built for somebody standing in an empty room holding a phone, which drove
 * every decision in here:
 *
 * - Several files at once, because they will have taken eleven photographs,
 *   not one.
 * - A real progress bar per file. The bytes go straight from the phone to the
 *   bucket, so a two minute video takes a visible amount of time and a
 *   spinner that says nothing for ninety seconds reads as broken. That is why
 *   this uses XMLHttpRequest rather than fetch: fetch still cannot report
 *   upload progress.
 * - One at a time, in order. Four videos uploading at once on a builder's
 *   site with one bar of signal is slower than four in a row, and it is the
 *   case where all four fail together.
 * - A failure names the file it was. "Upload failed" when eleven are in
 *   flight is not an error message.
 *
 * The note and the room are asked for before the files, because once the
 * upload starts the person has stopped reading the page.
 */

type Row = {
  key: string
  name: string
  size: number
  progress: number
  state: 'waiting' | 'sending' | 'done' | 'failed'
  problem?: string
}

type RoomOption = { id: string; name: string }

function put(url: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url, true)
    // The signed link covers the host and nothing else, so the browser is
    // free to say what the file is. Sending it means the bucket stores the
    // type and hands it back on a preview.
    if (file.type) request.setRequestHeader('Content-Type', file.type)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`The storage service refused it (${request.status}).`))
    }
    request.onerror = () => reject(new Error('The connection dropped part way through.'))
    request.onabort = () => reject(new Error('That upload was stopped.'))
    request.ontimeout = () => reject(new Error('That took too long and timed out.'))

    request.send(file)
  })
}

export function Uploader({
  projectSlug,
  rooms,
  disabled,
  disabledReason,
}: {
  projectSlug: string
  rooms: RoomOption[]
  disabled?: boolean
  disabledReason?: string
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [caption, setCaption] = useState('')
  const [roomId, setRoomId] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function send(files: File[]) {
    if (files.length === 0 || busy) return

    const queued: Row[] = files.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      progress: 0,
      state: 'waiting',
    }))

    setRows((current) => [...current, ...queued])
    setBusy(true)

    // Taken once, before the first upload starts. The person is free to type
    // a different note for the next batch while this one is still going.
    const noteForBatch = caption.trim()
    const roomForBatch = roomId || null
    let anyLanded = false

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const row = queued[index]
      update(row.key, { state: 'sending' })

      const started = await runAction(() =>
        requestUpload(projectSlug, {
          filename: file.name,
          contentType: file.type || undefined,
          sizeBytes: file.size,
          roomId: roomForBatch,
          caption: noteForBatch || null,
        }),
      )

      const ticket = (started as { data?: { uploadId: string; url: string } }).data

      if (started.error || !ticket) {
        update(row.key, { state: 'failed', problem: started.error ?? 'Could not start that one.' })
        continue
      }

      try {
        await put(ticket.url, file, (fraction) =>
          update(row.key, { progress: Math.round(fraction * 100) }),
        )
      } catch (error) {
        update(row.key, {
          state: 'failed',
          problem: error instanceof Error ? error.message : 'That upload did not finish.',
        })
        continue
      }

      const finished = await runAction(() => finishUpload(projectSlug, ticket.uploadId))

      if (finished.error) {
        update(row.key, { state: 'failed', problem: finished.error })
        continue
      }

      update(row.key, { state: 'done', progress: 100 })
      anyLanded = true
    }

    setBusy(false)
    if (input.current) input.current.value = ''
    if (anyLanded) {
      setCaption('')
      // The list of files is rendered by the page, so it has to be re-fetched
      // for the new ones to show up.
      router.refresh()
    }
  }

  if (disabled) {
    return (
      <div className="hairline rounded-xl border border-dashed bg-oyster/50 p-6 text-center">
        <p className="text-sm leading-relaxed text-driftwood-deep">
          {disabledReason ?? 'Sending files is not switched on yet.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs tracking-widest text-driftwood uppercase">
            What are we looking at
          </span>
          <input
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Great room, wall behind the sofa is 14 feet 6"
            className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink placeholder:text-driftwood/70"
          />
          <span className="mt-1 block text-xs leading-relaxed text-driftwood">
            Measurements are the useful bit. Put them here and they stay with the photo.
          </span>
        </label>

        {rooms.length > 0 ? (
          <label className="block">
            <span className="text-xs tracking-widest text-driftwood uppercase">Which room</span>
            <select
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="hairline mt-1.5 w-full rounded-md border bg-page px-3 py-2 text-sm text-ink sm:w-44"
            >
              <option value="">The whole house</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void send(Array.from(event.dataTransfer.files))
        }}
        className={`rounded-xl border border-dashed p-7 text-center transition-colors ${
          dragging ? 'border-seaglass bg-seaglass-wash' : 'hairline border bg-oyster/40'
        }`}
      >
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void send(Array.from(event.target.files ?? []))}
        />

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-md bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Sending' : 'Choose photos or videos'}
        </button>

        <p className="mt-3 text-sm leading-relaxed text-driftwood">
          Or drag them in. Several at once is fine, and they go up one after another so a big video
          does not hold up the rest.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="hairline rounded-md border bg-page px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{row.name}</span>
                <span
                  className={`shrink-0 text-xs ${
                    row.state === 'failed' ? 'text-clay-deep' : 'text-driftwood'
                  }`}
                >
                  {row.state === 'done'
                    ? 'Sent'
                    : row.state === 'failed'
                      ? 'Did not send'
                      : row.state === 'sending'
                        ? `${row.progress}%`
                        : 'Waiting'}
                </span>
              </div>

              {row.state === 'sending' || row.state === 'done' ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-oyster-deep">
                  <div
                    className="h-full rounded-full bg-seaglass-deep transition-[width] duration-200"
                    style={{ width: `${row.progress}%` }}
                  />
                </div>
              ) : null}

              {row.problem ? (
                <p className="mt-1.5 text-xs leading-relaxed text-clay-deep">{row.problem}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
