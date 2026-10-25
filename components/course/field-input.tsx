'use client'

import { fillSentence, type Field } from '@/lib/course-content'

/**
 * One question's answer box, for the weekly worksheets and the 2027 plan.
 *
 * It only draws and reports. Saving is the caller's: `onChange` on every
 * keystroke, `onCommit` when the person leaves the box or makes a choice,
 * which is the moment to save without waiting.
 */

const input =
  'hairline mt-2 w-full rounded-lg border bg-page px-3.5 py-2.5 text-[15px] text-ink placeholder:text-driftwood/70 focus:border-seaglass-deep focus:outline-none disabled:bg-oyster/60'

export function FieldInput({
  field,
  value,
  onChange,
  onCommit,
}: {
  field: Field
  value: unknown
  onChange: (value: unknown) => void
  onCommit: () => void
}) {
  const asText = typeof value === 'string' ? value : ''

  return (
    <>

    {field.kind === 'text' || field.kind === 'number' ? (
      <input
        type="text"
        inputMode={field.kind === 'number' ? 'decimal' : undefined}
        value={asText}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        className={input}
      />
    ) : null}

    {field.kind === 'long' ? (
      <textarea
        rows={4}
        value={asText}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        className={`${input} resize-y leading-relaxed`}
      />
    ) : null}

    {field.kind === 'choice' ? (
      <div className="mt-2 flex flex-wrap gap-2">
        {field.options.map((option) => {
          const picked = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={picked}
              onClick={() => {
                onChange(picked ? '' : option)
                onCommit()
              }}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                picked
                  ? 'border-seaglass-deep bg-seaglass-deep text-page'
                  : 'hairline bg-page text-driftwood-deep hover:bg-oyster'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    ) : null}

    {field.kind === 'checks' ? (
      <div className="mt-2 space-y-2">
        {field.options.map((option) => {
          const ticked = Array.isArray(value)
            ? (value as string[]).includes(option)
            : false
          return (
            <label
              key={option}
              className="hairline flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-[15px] text-ink hover:bg-oyster/60"
            >
              <input
                type="checkbox"
                checked={ticked}
                onChange={() => {
                  const was = Array.isArray(value) ? (value as string[]) : []
                  onChange(ticked ? was.filter((item) => item !== option) : [...was, option])
                  onCommit()
                }}
                className="mt-1 size-4 accent-[var(--color-seaglass-deep)]"
              />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
    ) : null}

    {field.kind === 'sentence' ? (
      <div className="mt-2 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {field.parts.map((part) => {
            const current = (value as Record<string, string> | undefined) ?? {}
            return (
              <label key={part.key} className="block">
                <span className="text-xs tracking-widest text-driftwood uppercase">{part.label}</span>
                <input
                  type="text"
                  value={current[part.key] ?? ''}
                  onChange={(event) => onChange({ ...current, [part.key]: event.target.value })}
                  onBlur={onCommit}
                  className={input}
                />
              </label>
            )
          })}
        </div>
        <p className="rounded-lg bg-seaglass-wash px-4 py-3 font-display text-lg leading-snug text-ink">
          {fillSentence(field, value as Record<string, string> | undefined)}
        </p>
      </div>
    ) : null}

    {field.kind === 'signature' ? (
      <div className="mt-2">
        <input
          type="text"
          value={(value as { name?: string } | undefined)?.name ?? ''}
          onChange={(event) =>
            onChange({ name: event.target.value, signedAt: new Date().toISOString() })
          }
          onBlur={onCommit}
          placeholder="Your full name"
          className={`${input} font-display text-xl`}
        />
      </div>
    ) : null}
    </>
  )
}
