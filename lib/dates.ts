/**
 * Dates, written the way Davina writes them.
 *
 * All of these are called from server components, so they render once on the
 * server and never differ between the HTML and what React draws afterwards.
 * Anywhere a date has to be formatted in the browser instead, the locale is
 * still pinned, because `en-US` on the server and the visitor's own locale in
 * the browser produce two different strings for the same date and React
 * replaces the first with the second in front of them.
 */

const LOCALE = 'en-US'

/** "October 3, 2026". For anything a client reads. */
export function longDate(value: Date): string {
  return value.toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** "Oct 3". For a list where the year is obvious and the room is tight. */
export function shortDate(value: Date): string {
  return value.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })
}

/** "Oct 3, 2:14 PM". For a log, where the time is the point. */
export function dateAndTime(value: Date): string {
  return value.toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * "Just now", "14 minutes ago", "Yesterday", then a date.
 *
 * Stops being relative after a week. "43 days ago" is arithmetic nobody
 * wanted; at that distance the date itself is the useful thing.
 */
export function howLongAgo(value: Date, now = new Date()): string {
  const seconds = Math.floor((now.getTime() - value.getTime()) / 1000)

  if (seconds < 45) return 'Just now'
  if (seconds < 90) return 'A minute ago'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'An hour ago' : `${hours} hours ago`

  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return longDate(value)
}
