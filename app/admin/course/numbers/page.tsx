import Link from 'next/link'
import { Card, EmptyState, PageHeader, SectionHeading } from '@/components/ui'
import { prisma } from '@/lib/db'
import { StartingNumbersForm } from '../forms'

export const dynamic = 'force-dynamic'

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`

/**
 * Where each agent's 2027 plan starts.
 *
 * These live in the database and nowhere else. They are a person's earnings,
 * and the code for this site is readable by anyone, so they are loaded here
 * rather than written into it.
 */
export default async function StartingNumbersPage() {
  const [rows, users] = await Promise.all([
    prisma.planStart.findMany({ orderBy: { email: 'asc' } }),
    prisma.user.findMany({ select: { email: true, name: true } }),
  ])
  const names = new Map(users.map((user) => [user.email, user.name]))

  return (
    <div className="space-y-10">
      <Link href="/admin/course" className="text-sm text-driftwood hover:text-ink">
        ← The class
      </Link>

      <PageHeader
        eyebrow="Course"
        title="Starting numbers"
        intro="Where each agent's 2027 plan begins. Take-home only, never gross: what reaches them after the split, referral fees, the team fee and the brokerage fee. Whatever an agent types in their own plan wins over these."
      />

      <section className="space-y-4">
        <SectionHeading title="Load or update" />
        <Card className="p-5">
          <StartingNumbersForm />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Loaded" />
        {rows.length === 0 ? (
          <EmptyState>Nothing loaded yet.</EmptyState>
        ) : (
          <div className="hairline overflow-x-auto rounded-xl border bg-page shadow-sheet">
            <table className="w-full text-sm">
              <thead>
                <tr className="hairline border-b text-left text-xs tracking-wider text-driftwood uppercase">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-3 py-3 text-right font-medium">2026 closings</th>
                  <th className="px-3 py-3 text-right font-medium">Take-home per closing</th>
                  <th className="px-3 py-3 text-right font-medium">Database</th>
                  <th className="px-3 py-3 text-right font-medium">2027 target</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email} className="hairline border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="text-ink">{names.get(row.email) ?? row.email}</span>
                      {names.has(row.email) ? null : <span className="ml-2 text-xs text-driftwood">not signed up yet</span>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.closings2026}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(row.takeHomeCents)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.databaseCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.target2027}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
