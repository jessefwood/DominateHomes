'use client'

import { useState, useTransition } from 'react'
import { runAction, type ActionResult } from '@/lib/client-action'

/**
 * One editing widget, used everywhere something is edited.
 *
 * Davina edits a project, a room, a piece and the three options for it, and
 * before this each of those would have been its own hand built form. One
 * component means every edit screen behaves the same: the same Save button in
 * the same place, the same confirmation, the same thing on a failure. That
 * consistency is the whole reason this is easy to use rather than a tour of
 * ten slightly different forms.
 *
 * Nothing saves until Save is pressed. Autosave on blur sounds kinder and is
 * not: it fires while you are still deciding, and there is no way to abandon
 * an edit you have thought better of.
 */

export type FieldKind = 'text' | 'textarea' | 'url' | 'photo' | 'number' | 'money' | 'select' | 'checkbox'

export type FieldDef = {
  name: string
  label: string
  value: string
  kind?: FieldKind
  hint?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  /** Lays the field across both columns. For prose and for photographs. */
  wide?: boolean
}

const INPUT =
  'hairline w-full rounded-lg border bg-page px-3 py-2 text-sm text-ink transition-colors placeholder:text-driftwood/60 focus:border-seaglass'

export function EditForm({
  fields,
  action,
  submitLabel = 'Save',
  intro,
}: {
  fields: FieldDef[]
  action: (values: Record<string, string>) => Promise<ActionResult>
  submitLabel?: string
  intro?: string
}) {
  const initial = Object.fromEntries(fields.map((field) => [field.name, field.value]))
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [message, setMessage] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const dirty = fields.some((field) => values[field.name] !== initial[field.name])

  function set(name: string, value: string) {
    setMessage(null)
    setValues((was) => ({ ...was, [name]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await runAction(() => action(values))
      setMessage(result.error ? result : { note: result.note ?? 'Saved.' })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {intro ? <p className="text-sm leading-relaxed text-driftwood-deep">{intro}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.wide ? 'sm:col-span-2' : undefined}>
            <label
              htmlFor={`f-${field.name}`}
              className="block text-xs tracking-wide text-driftwood uppercase"
            >
              {field.label}
            </label>

            {field.kind === 'textarea' ? (
              <textarea
                id={`f-${field.name}`}
                rows={4}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => set(field.name, event.target.value)}
                className={`${INPUT} mt-1.5 leading-relaxed`}
              />
            ) : field.kind === 'select' ? (
              <select
                id={`f-${field.name}`}
                value={values[field.name] ?? ''}
                onChange={(event) => set(field.name, event.target.value)}
                className={`${INPUT} mt-1.5`}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.kind === 'checkbox' ? (
              <label className="mt-1.5 flex items-center gap-2.5 text-sm text-driftwood-deep">
                <input
                  id={`f-${field.name}`}
                  type="checkbox"
                  checked={values[field.name] === 'yes'}
                  onChange={(event) => set(field.name, event.target.checked ? 'yes' : '')}
                  className="size-4 accent-[var(--color-seaglass-deep)]"
                />
                {field.hint ?? 'Yes'}
              </label>
            ) : (
              <input
                id={`f-${field.name}`}
                type={field.kind === 'number' || field.kind === 'money' ? 'text' : 'text'}
                inputMode={field.kind === 'number' || field.kind === 'money' ? 'decimal' : undefined}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => set(field.name, event.target.value)}
                className={`${INPUT} mt-1.5`}
              />
            )}

            {field.kind !== 'checkbox' && field.hint ? (
              <p className="mt-1.5 text-xs leading-relaxed text-driftwood">{field.hint}</p>
            ) : null}

            {field.kind === 'photo' ? <PhotoPreview url={values[field.name] ?? ''} /> : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-ink px-4 py-2 text-sm text-page transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? 'Saving' : submitLabel}
        </button>

        {dirty && !pending ? (
          <button
            type="button"
            onClick={() => {
              setValues(initial)
              setMessage(null)
            }}
            className="text-sm text-driftwood transition-colors hover:text-ink"
          >
            Undo
          </button>
        ) : null}

        {message?.error ? (
          <span className="text-sm text-clay-deep">{message.error}</span>
        ) : message?.note ? (
          <span className="text-sm text-seaglass-deep">{message.note}</span>
        ) : null}
      </div>
    </form>
  )
}

/**
 * What the picture will look like, while the link is still being pasted.
 *
 * A URL field for an image with no preview is a guess. Half of what people
 * paste is a link to the page the image is on rather than the image, and the
 * only way to tell is to look. onError is what catches that, and it says the
 * useful thing rather than "invalid".
 */
function PhotoPreview({ url }: { url: string }) {
  // Which URL failed, not whether one did. A plain boolean stays true after
  // the text is corrected, and because the broken state hides the img there is
  // then nothing left to fire onLoad and clear it. The preview never comes
  // back and the next paste looks broken too.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const trimmed = url.trim()
  const broken = brokenUrl !== null && brokenUrl === trimmed

  if (!trimmed) {
    return (
      <p className="mt-2 text-xs leading-relaxed text-driftwood">
        Paste a link that ends in .jpg, .png or .webp. On most sites: right click the picture,
        then Copy image address.
      </p>
    )
  }

  return (
    <div className="mt-2.5">
      {broken ? (
        <p className="rounded-lg bg-clay-wash px-3 py-2 text-xs leading-relaxed text-clay-deep">
          That link did not load as a picture. It is usually the address of the page the picture
          is on rather than the picture itself. Right click the picture and choose Copy image
          address.
        </p>
      ) : (
        <div className="photo-frame aspect-[4/3] w-full max-w-56 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={trimmed}
            src={trimmed}
            alt=""
            onError={() => setBrokenUrl(trimmed)}
            onLoad={() => setBrokenUrl(null)}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  )
}
