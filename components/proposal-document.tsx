import { BudgetType, ProposalScopeKind, ProposalStatus } from '@prisma/client'
import { Pill } from '@/components/ui'
import { formatCents, formatCentsExact } from '@/lib/money'
import { proposalSides, TIER_LABEL, type FullProposal } from '@/lib/proposals'

/**
 * The proposal, rendered. The same component serves the designer's preview and
 * the client's copy, so there is no way for the two to drift apart and no way
 * to send something that was never looked at.
 *
 * Every figure here comes off the proposal record. Nothing is recomputed from
 * a room or a budget line, which is rule 3 holding at the view layer as well
 * as in the database.
 */

const SCOPE_HEADINGS: Record<ProposalScopeKind, string> = {
  [ProposalScopeKind.INCLUDED]: 'Included',
  [ProposalScopeKind.NOT_INCLUDED]: 'Not included',
  [ProposalScopeKind.CLIENT_OWNED]: 'What you already own, worked in at no cost',
}

const STATUS_TONE = {
  [ProposalStatus.DRAFT]: 'neutral',
  [ProposalStatus.SENT]: 'sea',
  [ProposalStatus.ACCEPTED]: 'ink',
  [ProposalStatus.DECLINED]: 'clay',
  [ProposalStatus.WITHDRAWN]: 'neutral',
} as const

function Row({
  label,
  detail,
  amountCents,
  strong = false,
}: {
  label: string
  detail?: string | null
  amountCents: number
  strong?: boolean
}) {
  return (
    <div className="hairline flex items-baseline justify-between gap-6 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className={strong ? 'text-ink' : 'text-sm text-ink'}>{label}</p>
        {detail ? (
          <p className="mt-0.5 text-sm leading-relaxed text-driftwood">{detail}</p>
        ) : null}
      </div>
      <p className={`shrink-0 tabular-nums ${strong ? 'text-ink' : 'text-sm text-driftwood-deep'}`}>
        {formatCents(amountCents)}
      </p>
    </div>
  )
}

function Section({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display flex items-baseline gap-3 text-lg text-ink">
        <span className="text-sm tabular-nums text-driftwood">{number}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function ProposalDocument({ proposal }: { proposal: FullProposal }) {
  const furnishing = proposal.lines.filter((line) => line.type === BudgetType.FURNISHING)
  const expenses = proposal.lines.filter((line) => line.type === BudgetType.EXPENSE)
  const sides = proposalSides(proposal)

  const grouped = [
    ProposalScopeKind.INCLUDED,
    ProposalScopeKind.NOT_INCLUDED,
    ProposalScopeKind.CLIENT_OWNED,
  ]
    .map((kind) => ({ kind, items: proposal.scope.filter((row) => row.kind === kind) }))
    .filter((group) => group.items.length > 0)

  return (
    <article className="hairline rounded-lg border bg-white px-6 py-8 sm:px-10 sm:py-10">
      <header className="hairline flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-xs tracking-widest text-driftwood uppercase">
            Proposal {proposal.number}
          </p>
          <h1 className="font-display mt-1 text-2xl leading-tight text-ink">
            {proposal.preparedForLabel}
          </h1>
          <p className="mt-1 text-sm text-driftwood">
            {TIER_LABEL[proposal.tier]} level
            {proposal.issuedOn ? ` · issued ${proposal.issuedOn.toLocaleDateString('en-US', { dateStyle: 'long' })}` : null}
            {proposal.validUntilOn
              ? ` · good until ${proposal.validUntilOn.toLocaleDateString('en-US', { dateStyle: 'long' })}`
              : null}
          </p>
        </div>
        <Pill tone={STATUS_TONE[proposal.status]}>{proposal.status.toLowerCase()}</Pill>
      </header>

      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-driftwood-deep">
        {proposal.intro}
      </p>

      <Section number="01" title="Furnishings by room">
        <div>
          {furnishing.map((line) => (
            <Row key={line.id} label={line.label} detail={line.detail} amountCents={line.amountCents} />
          ))}
        </div>
        <div className="mt-2 border-t border-ink/15 pt-2">
          <Row label="Furnishings subtotal" amountCents={proposal.furnishingsSubtotalCents} />
          <Row
            label={`Florida sales tax at ${(proposal.taxRateBasisPoints / 100).toFixed(1)}%`}
            amountCents={proposal.taxCents}
          />
          <Row label="Freight, delivery and assembly" amountCents={proposal.freightCents} />
          <Row label="Goods, delivered" amountCents={proposal.goodsDeliveredCents} strong />
        </div>
      </Section>

      <Section number="02" title="Design fee and expenses">
        <div>
          {expenses.map((line) => (
            <Row key={line.id} label={line.label} detail={line.detail} amountCents={line.amountCents} />
          ))}
        </div>
        <div className="mt-2 border-t border-ink/15 pt-2">
          <Row label="Design fee and expenses" amountCents={sides.feesAndExpensesCents} strong />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-driftwood">
          This is kept separate from the furnishing spend above and is never drawn from it. Two
          totals, always reported apart, which was your rule.
        </p>
      </Section>

      <div className="mt-8 rounded-md bg-sand/50 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-display text-lg text-ink">What this comes to</p>
            <p className="mt-0.5 text-sm text-driftwood">
              {formatCents(sides.goodsDeliveredCents)} of goods delivered, plus{' '}
              {formatCents(sides.feesAndExpensesCents)} of design fee and expenses.
            </p>
          </div>
          <p className="font-display text-2xl tabular-nums text-ink">
            {formatCents(sides.whatSheWouldPayCents)}
          </p>
        </div>
      </div>

      {proposal.payments.length > 0 ? (
        <Section number="03" title="Payment schedule">
          <div>
            {proposal.payments.map((row) => (
              <Row
                key={row.id}
                label={row.whenLabel}
                detail={row.detail}
                amountCents={row.amountCents}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-driftwood tabular-nums">
            Total {formatCentsExact(proposal.payments.reduce((sum, r) => sum + r.amountCents, 0))}
          </p>
        </Section>
      ) : null}

      {grouped.length > 0 ? (
        <Section number="04" title="Scope">
          <div className="grid gap-6 sm:grid-cols-2">
            {grouped.map((group) => (
              <div key={group.kind}>
                <p className="text-xs tracking-widest text-driftwood uppercase">
                  {SCOPE_HEADINGS[group.kind]}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {group.items.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-sm leading-relaxed">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-driftwood" />
                      <span className="text-driftwood-deep">{row.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section number="05" title="How the selections work">
        <p className="max-w-2xl text-sm leading-relaxed text-driftwood-deep">
          You will never see more than three options for any single item. That was your rule and it
          is ours now, and it is built into how this portal stores a selection rather than just how
          it displays one. Selections come in rounds by room, with images and dimensions, and nothing
          is ordered until you have picked. If a piece lands under or over its room estimate, the
          difference shows on the next statement. You approve every substitution.
        </p>
      </Section>

      {proposal.status === ProposalStatus.ACCEPTED && proposal.acceptedAt ? (
        <Section number="06" title="Accepted">
          <div className="rounded-md bg-seaglass-wash px-5 py-4">
            <p className="text-sm text-ink">
              Signed by {proposal.acceptedByName} on{' '}
              {proposal.acceptedAt.toLocaleDateString('en-US', { dateStyle: 'long' })}.
            </p>
            {proposal.statementShown ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-driftwood-deep">
                &ldquo;{proposal.statementShown}&rdquo;
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {proposal.status === ProposalStatus.DECLINED ? (
        <Section number="06" title="Declined">
          <p className="text-sm text-driftwood-deep">
            {proposal.declineNote ?? 'No reason was given.'}
          </p>
        </Section>
      ) : null}
    </article>
  )
}
