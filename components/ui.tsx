import Link from 'next/link'

export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
}: {
  eyebrow?: string
  title: string
  intro?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="font-display mt-1.5 text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {intro ? (
          <p className="mt-3 text-[15px] leading-relaxed text-driftwood-deep">{intro}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  )
}

export function Card({
  href,
  id,
  children,
  className = '',
}: {
  href?: string
  /** For linking straight to one card, e.g. an open item from an email. */
  id?: string
  children: React.ReactNode
  className?: string
}) {
  const base = `hairline overflow-hidden rounded-xl border bg-page shadow-sheet ${className}`
  if (!href) return <div id={id} className={base}>{children}</div>
  return (
    <Link
      id={id}
      href={href}
      className={`${base} block transition-shadow duration-200 hover:shadow-lifted`}
    >
      {children}
    </Link>
  )
}

const TONES = {
  neutral: 'bg-oyster text-driftwood-deep',
  sea: 'bg-seaglass-wash text-seaglass-deep',
  ink: 'bg-ink text-page',
  clay: 'bg-clay-wash text-clay-deep',
} as const

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: keyof typeof TONES
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** A flag for something genuinely unresolved. Shown, not hidden. */
export function OpenQuestion({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-clay/25 bg-clay-wash p-4 text-sm leading-relaxed text-driftwood-deep">
      <span className="mr-1.5 font-medium text-clay-deep">Still open.</span>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="hairline rounded-xl border border-dashed bg-oyster/70 p-6 text-sm leading-relaxed text-driftwood-deep">
      {children}
    </div>
  )
}

/**
 * A photograph from somewhere else.
 *
 * Deliberately a plain `img` rather than `next/image`. These URLs are vendor
 * product pages and whatever Davina pasted in, on hosts nobody can enumerate
 * ahead of time, so the allowlist `next/image` needs cannot be written. Its
 * optimizer would also turn a dead link into a server error instead of a
 * missing picture, and a missing picture is the right failure here.
 *
 * `aspect` keeps a grid of photos from different vendors on one baseline,
 * which is most of what makes a page of them look arranged rather than dumped.
 */
export function Photo({
  src,
  alt,
  aspect = 'aspect-[4/3]',
  className = '',
}: {
  src: string | null | undefined
  alt: string
  aspect?: string
  className?: string
}) {
  if (!src) return null

  return (
    <div className={`photo-frame rounded-lg ${aspect} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </div>
  )
}

/** The placeholder where a photograph would go, so the gap is legible. */
export function PhotoMissing({
  aspect = 'aspect-[4/3]',
  children,
  className = '',
}: {
  aspect?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`hairline flex items-center justify-center rounded-lg border border-dashed bg-oyster/60 ${aspect} ${className}`}
    >
      <span className="px-3 text-center text-xs leading-relaxed text-driftwood">
        {children ?? 'No photo yet'}
      </span>
    </div>
  )
}

export function SectionHeading({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {action}
    </div>
  )
}
