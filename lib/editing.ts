/**
 * Turning what someone typed into something the database will accept.
 *
 * These screens are used by Davina, not by an API client, so the input is
 * whatever a person types: a price with a dollar sign in it, a URL with a
 * space on the end from a copy and paste, an empty box meaning "leave it
 * blank" rather than "set it to the empty string". Every one of those should
 * work, and the ones that genuinely cannot should say why in a sentence
 * rather than fail validation.
 */

export class EditError extends Error {}

/** Empty, after trimming, means the column goes back to null. */
export function optionalText(raw: string | undefined): string | null {
  const value = raw?.trim()
  return value ? value : null
}

export function requiredText(raw: string | undefined, label: string): string {
  const value = raw?.trim()
  if (!value) throw new EditError(`${label} cannot be empty.`)
  return value
}

/**
 * A link somebody pasted.
 *
 * http and https only. A `javascript:` or `data:` URL in a field that later
 * becomes an href or an img src is how a stored cross-site script gets in, and
 * these fields are written by one person but read by the client.
 */
export function optionalUrl(raw: string | undefined, label: string): string | null {
  const value = raw?.trim()
  if (!value) return null

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new EditError(
      `${label} does not look like a web address. It needs to start with https:// and have no spaces in it.`,
    )
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EditError(`${label} has to be an https:// address.`)
  }

  return parsed.toString()
}

/**
 * Money, typed by a person, stored in cents.
 *
 * Parsed off the digits rather than through parseFloat, because a float cannot
 * hold a price exactly and the whole point of storing cents is not to have
 * one. $1,234.5 is 123450 cents, and a third decimal is a typo worth saying
 * out loud rather than rounding away in silence.
 */
export function moneyToCents(raw: string | undefined, label: string): number {
  const value = raw?.trim().replace(/[$,\s]/g, '')
  if (!value) throw new EditError(`${label} cannot be empty.`)

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) {
    throw new EditError(
      `${label} should be a plain amount like 1250 or 1250.00. Cents go after the point, and there are only two of them.`,
    )
  }

  const dollars = Number(match[1])
  const cents = Number((match[2] ?? '').padEnd(2, '0'))

  if (!Number.isSafeInteger(dollars)) throw new EditError(`${label} is larger than makes sense.`)

  return dollars * 100 + cents
}

export function optionalMoneyToCents(raw: string | undefined, label: string): number | null {
  return raw?.trim() ? moneyToCents(raw, label) : null
}

export function optionalWholeNumber(raw: string | undefined, label: string): number | null {
  const value = raw?.trim()
  if (!value) return null

  if (!/^\d+$/.test(value)) throw new EditError(`${label} should be a whole number, with no letters in it.`)

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new EditError(`${label} is larger than makes sense.`)
  return parsed
}

export function checkbox(raw: string | undefined): boolean {
  return raw === 'yes'
}

/** Cents back into something an input box can show. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}
