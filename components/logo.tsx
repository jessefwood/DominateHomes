/**
 * The mark.
 *
 * An arch standing on a floor line, drawn as one continuous stroke so the legs
 * and the floor meet cleanly rather than overlapping into a blob at small
 * sizes. The viewBox is cropped to the drawing rather than left square, because
 * the first cut sat in the middle of a 40 by 40 box with half of it empty and
 * rendered as a tiny shape floating in whitespace. An arch rather than a house outline for two reasons: a pitched roof
 * reads as a real estate listing, and the arched opening is the detail this
 * kind of interior work is actually full of. It survives 16 pixels, which a
 * monogram in a serif face would not.
 *
 * The stroke is `currentColor` throughout, so one file serves the dark header,
 * the light footer and the favicon tile without a second variant to keep in
 * sync.
 */

export function Logomark({
  className = '',
  title,
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 24 17"
      className={className}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M1.2 15.8h4.3V9a6.5 6.5 0 0 1 13 0v6.8h4.3"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** The mark on its tile, for a favicon, an avatar or a dark header. */
export function LogoTile({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[22%] bg-ink text-oyster ${className}`}
    >
      <Logomark className="w-[62%]" />
    </span>
  )
}

/**
 * The full lockup. The wordmark is letterspaced caps in the text face rather
 * than the display serif: next to the headline type the serif competes, and
 * caps hold their shape at the size a header actually uses.
 */
export function Logo({
  className = '',
  tone = 'ink',
}: {
  className?: string
  tone?: 'ink' | 'oyster'
}) {
  const colour = tone === 'oyster' ? 'text-oyster' : 'text-ink'

  return (
    <span className={`inline-flex items-center gap-2.5 ${colour} ${className}`}>
      <Logomark className="w-8 shrink-0" title="Dominate Homes" />
      <span className="text-[0.8125rem] leading-none font-medium tracking-[0.18em] uppercase">
        Dominate Homes
      </span>
    </span>
  )
}
