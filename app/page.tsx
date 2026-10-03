import Link from 'next/link'
import { SiteFooter, SiteNav } from '@/components/site-nav'

export const metadata = {
  title: 'Dominate Homes',
  description: 'Furnishing and styling new builds on the Treasure Coast.',
}

/**
 * The public page at the front of the site. No sign-in, no database. The
 * client portal lives at /portal behind a sign-in link.
 *
 * Copy is written the way Davina talks. No em dashes, speaking to the reader
 * rather than at them. Everything here is about how the work actually runs,
 * because that is the thing that is different.
 */

const STEPS = [
  {
    n: '01',
    title: 'We walk the plan',
    body: 'Before a single thing is bought we go room by room with the builder plan, the real dimensions and what you already own. Most of what goes wrong in a house like this is decided at this stage, not at the shop.',
  },
  {
    n: '02',
    title: 'Three options. Never more.',
    body: 'For every piece you get three choices, priced, measured and ready to compare. Not a mood board with forty sofas on it. Three is enough to feel like a decision and few enough that you actually make one.',
  },
  {
    n: '03',
    title: 'You sign off room by room',
    body: 'Nothing is ordered until you have approved the room in writing, at a price you saw. We record exactly what you agreed to on the day, because prices move between approving something and ordering it.',
  },
  {
    n: '04',
    title: 'We run the install',
    body: 'Freight, delivery windows, assembly, hanging the art, the lot. You get the house finished rather than a garage full of boxes.',
  },
]

const TEAM = [
  {
    name: 'Davina Hughes',
    role: 'Selections and styling',
    body: 'Davina runs the design side: the direction, the room plans, every selection and the install. She works in new builds across the Treasure Coast, and most of her projects start before the drywall is up.',
  },
  {
    name: 'Jesse Wood',
    role: 'Operations',
    body: 'Jesse handles the numbers and the logistics: budgets, proposals, ordering, and keeping a project with a dozen vendors in it on a timeline that actually holds.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-20 sm:px-10 sm:pt-32 sm:pb-28">
          <p className="eyebrow">Port St. Lucie, Florida</p>
          <h1 className="font-display mt-6 max-w-4xl text-[2.75rem] leading-[1.04] text-ink sm:text-6xl lg:text-7xl">
            A finished house, not a folder of ideas.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-[1.7] text-driftwood-deep">
            We furnish new builds end to end, from the empty plan to the day you walk in. Every room costed,
            every piece measured against the wall it is going on, and every decision narrowed to three options
            so you can actually make it.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="#contact"
              className="rounded-md bg-ink px-5 py-2.5 text-oyster transition-opacity hover:opacity-90"
            >
              Start a project
            </Link>
            <Link
              href="/signin"
              className="hairline rounded-md border px-5 py-2.5 text-ink transition-colors hover:bg-sand/50"
            >
              Client login
            </Link>
          </div>
        </section>

        <section id="work" className="hairline border-t bg-white/60">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">How a project runs</h2>
            <p className="mt-2 max-w-2xl text-driftwood-deep">
              You get a login to your own project from the first week, and it stays current until the last box
              is gone.
            </p>

            <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <p className="font-display text-lg text-seaglass-deep">{step.n}</p>
                  <h3 className="mt-2 font-display text-2xl leading-snug text-ink">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-driftwood-deep">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
          <div className="hairline rounded-lg border bg-white p-8 sm:p-12">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Your project, in one place</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-driftwood-deep">
              Every client gets a portal. It holds the room plans, the three options for each piece, what you
              have approved, where the money has gone, the furniture you are keeping, and what is on order. You
              sign in with a link sent to your email, so there is no password to lose.
            </p>
            <ul className="mt-8 grid gap-x-12 gap-y-3 text-driftwood-deep sm:grid-cols-2">
              <li>Room by room, with real dimensions</li>
              <li>Three options per item, priced</li>
              <li>Written sign-off before anything orders</li>
              <li>Furnishings and our fees kept as separate totals</li>
              <li>Your own furniture, placed room by room</li>
              <li>Order tracking through to delivery</li>
            </ul>
          </div>
        </section>

        <section id="team" className="hairline border-t bg-white/60">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Who you are working with</h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {TEAM.map((person) => (
                <div key={person.name} className="hairline rounded-lg border bg-white p-6">
                  <p className="eyebrow">{person.role}</p>
                  <h3 className="font-display mt-1 text-xl text-ink">{person.name}</h3>
                  <p className="mt-2 leading-relaxed text-driftwood-deep">{person.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <div className="hairline rounded-lg border bg-seaglass-wash p-8 sm:p-12">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Starting a project</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-driftwood-deep">
              Tell us the plan, the builder and roughly when you close. We will tell you what the house needs
              and what it costs, honestly, before you commit to anything.
            </p>
            <p className="mt-5">
              <a
                href="mailto:info@dominatehomes.com"
                className="rounded-md bg-ink px-5 py-2.5 text-oyster transition-opacity hover:opacity-90 inline-block"
              >
                Email us
              </a>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
