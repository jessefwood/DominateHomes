/**
 * Money is stored in cents everywhere. Nothing in this project should hold a
 * dollar float: the budget runs to six figures and the approval record has to
 * add up to the cent years after it was signed.
 */

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/** Keeps the cents where a figure is a real transacted amount, not a band. */
export function formatCentsExact(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function dollars(amount: number): number {
  return Math.round(amount * 100)
}

/** A planning band, shown as a range rather than a single false-precision number. */
export function formatBand(lowCents: number, highCents: number): string {
  if (lowCents === highCents) return formatCents(lowCents)
  return `${formatCents(lowCents)} to ${formatCents(highCents)}`
}
