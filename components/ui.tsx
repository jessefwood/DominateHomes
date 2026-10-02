import Link from 'next/link'

export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow?: string
  title: string
  intro?: string
}) {
  return (
    <header className="max-w-2xl">
      {eyebrow ? <p className="text-xs tracking-widest text-driftwood uppercase">{eyebrow}</p> : null}
      <h1 className="font-display mt-1 text-3xl leading-tight text-ink">{title}</h1>
      {intro ? <p className="mt-3 text-[15px] leading-relaxed text-driftwood-deep">{intro}</p> : null}
    </header>
  )
}

export function Card({
  href,
  children,
  className = '',
}: {
  href?: string
  children: React.ReactNode
  className?: string
}) {
  const base = `hairline rounded-lg border bg-white ${className}`
  if (!href) return <div className={base}>{children}</div>
  return (
    <Link href={href} className={`${base} block transition-shadow hover:shadow-[0_1px_12px_rgba(28,26,23,0.07)]`}>
      {children}
    </Link>
  )
}

const TONES = {
  neutral: 'bg-sand text-driftwood-deep',
  sea: 'bg-seaglass-wash text-seaglass-deep',
  ink: 'bg-ink text-oyster',
  clay: 'bg-clay/10 text-clay',
} as const

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: keyof typeof TONES
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  )
}

/** A flag for something genuinely unresolved. Shown, not hidden. */
export function OpenQuestion({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-clay/25 bg-clay/5 p-3 text-sm leading-relaxed text-driftwood-deep">
      <span className="mr-1.5 font-medium text-clay">Still open.</span>
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="hairline rounded-lg border border-dashed bg-oyster-deep/50 p-6 text-sm leading-relaxed text-driftwood-deep">
      {children}
    </div>
  )
}
