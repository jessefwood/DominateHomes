import { courseDate, fillSentence, isAnswered, type Course, type Field } from '@/lib/course-content'
import type { Answers } from '@/lib/course'
import { longDate } from '@/lib/dates'

/**
 * Everything one person has written in a course, laid out to read or print.
 *
 * Used twice: an agent's own workbook, and Davina reading an agent's homework
 * from the class roster. Same layout on purpose, so when they talk about
 * "question 7" they are looking at the same thing.
 */

function Answer({ field, value }: { field: Field; value: unknown }) {
  if (!isAnswered(field, value)) return <p className="text-sm text-driftwood italic">Not answered yet</p>

  switch (field.kind) {
    case 'text':
    case 'long':
    case 'number':
    case 'choice':
      return <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{value as string}</p>
    case 'checks':
      return (
        <ul className="space-y-1 text-[15px] text-ink">
          {field.options.map((option) => {
            const ticked = (value as string[]).includes(option)
            return (
              <li key={option} className={ticked ? '' : 'text-driftwood'}>
                <span aria-hidden className="mr-2 inline-block w-4">
                  {ticked ? '☑' : '☐'}
                </span>
                <span className="sr-only">{ticked ? 'Checked: ' : 'Not checked: '}</span>
                {option}
              </li>
            )
          })}
        </ul>
      )
    case 'sentence':
      return (
        <p className="font-display text-lg leading-snug text-ink">
          {fillSentence(field, value as Record<string, string>)}
        </p>
      )
    case 'signature': {
      const signed = value as { name: string; signedAt: string }
      const at = new Date(signed.signedAt)
      return (
        <p className="text-ink">
          <span className="font-display text-xl">{signed.name}</span>
          {Number.isNaN(at.getTime()) ? null : (
            <span className="ml-3 text-sm text-driftwood">signed {longDate(at)}</span>
          )}
        </p>
      )
    }
  }
}

export function WorkbookView({
  course,
  answers,
  turnIns,
}: {
  course: Course
  answers: Record<string, Answers>
  turnIns: Record<string, Date | null>
}) {
  return (
    <div className="space-y-10">
      {course.modules.map((unit) => {
        const mine = answers[unit.key] ?? {}
        const turnedIn = turnIns[unit.key]
        return (
          <section key={unit.key} className="break-inside-avoid-page space-y-5">
            <div className="hairline flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
              <div>
                <p className="eyebrow">
                  Module {unit.number} · {courseDate(unit.date)}
                </p>
                <h2 className="font-display mt-1 text-2xl text-ink">{unit.worksheet.title}: {unit.title}</h2>
              </div>
              <p className="text-sm text-driftwood">
                {turnedIn ? `Turned in ${longDate(turnedIn)}` : `Due ${courseDate(unit.worksheet.due)}`}
              </p>
            </div>

            <ol className="space-y-5">
              {unit.worksheet.fields.map((field, index) => (
                <li key={field.key} className="break-inside-avoid">
                  <p className="text-sm font-medium text-driftwood-deep">
                    {index + 1}. {field.label}
                  </p>
                  <div className="mt-1.5">
                    <Answer field={field} value={mine[field.key]} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
