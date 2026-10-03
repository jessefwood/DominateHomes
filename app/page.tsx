import Link from 'next/link'
import { SiteFooter, SiteNav } from '@/components/site-nav'
import { showcaseProjects, siteSettings } from '@/lib/site'

export const metadata = {
  title: 'Dominate Homes',
  description: 'Furnishing and styling new builds, room by room. Based in Chesapeake, Virginia.',
}

/**
 * Rendered per request, because this page now reads the database.
 *
 * Without this Next prerenders it once at build time. Both reads below fall
 * back to empty when the database is unreachable, and during a build it is,
 * so the page would be baked empty and stay empty: Davina would paste a
 * photograph into admin, see nothing change, and reasonably conclude it was
 * broken. The page is small and the traffic is low, so rendering it each time
 * costs little and removes a whole class of "I changed it and nothing
 * happened".
 */
export const dynamic = 'force-dynamic'

/**
 * The public page at the front of the site.
 *
 * Copy is written the way Davina talks. No em dashes, speaking to the reader
 * rather than at them. Everything here is about how the work actually runs,
 * because that is the thing that is different.
 *
 * WHAT MAKES THIS CREDIBLE, AND WHAT IS DELIBERATELY NOT HERE. There are no
 * invented numbers, no "200 homes furnished", no badges and no testimonials
 * written by me. A stranger deciding whether to hand over a house cannot check
 * any of that, and a prospective client who later finds out a number was made
 * up has learned something true about how we work. What is here instead is
 * specific and checkable: the three rules, which are unusual and which we are
 * held to; the actual sequence of a project; two named people with what each
 * of them does; and the real work, once there are photographs of it.
 *
 * The one quote slot pulls from the database and stays hidden until somebody
 * puts a real client's words in it.
 *
 * THE PAGE HAS TO LOOK FINISHED WITH NOTHING FILLED IN. Every photograph here
 * is optional. With no hero image the top is a typographic opener that stands
 * on its own; with one it is a photograph with the headline over it. Same for
 * the work gallery and the team. A marketing page that only works once six
 * pictures have been pasted in is a page that sits broken for a month.
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
    key: 'davinaPhotoUrl' as const,
    body: 'Davina runs the look: the direction, the room plans, every selection and the install. Most of her projects start before the drywall is up, which is the point at which the decisions that matter are still cheap to make.',
  },
  {
    name: 'Jesse Wood',
    role: 'Operations',
    key: 'jessePhotoUrl' as const,
    body: 'Jesse handles the numbers and the logistics: budgets, proposals, ordering, and keeping a project with a dozen vendors in it on a timeline that actually holds.',
  },
]

/**
 * The three rules, stated plainly.
 *
 * These are the most persuasive thing on the page and the reason they are not
 * marketing: all three are enforced in the database and covered by tests. A
 * fourth option has nowhere to go, furnishing spend and our fees cannot be
 * written into the same total, and an approval copies the price as a literal
 * at the moment of signing. Saying so is a promise we can be held to.
 */
const RULES = [
  {
    title: 'Never more than three options',
    body: 'Not a guideline. The system physically cannot hold a fourth option for an item, so nobody can quietly widen it on a busy week.',
  },
  {
    title: 'Your furnishing budget and our fees never blend',
    body: 'They are two separate totals that cannot be added together by accident. You always know which money is buying furniture.',
  },
  {
    title: 'An approval records the price you saw',
    body: 'Signing off copies the price, the lead time and the vendor as they were that day. Prices move between approving and ordering, and the record shows what you actually agreed to.',
  },
]

export default async function HomePage() {
  const [settings, projects] = await Promise.all([siteSettings(), showcaseProjects()])

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main>
        {/* ---------------------------------------------------------------
            The opener. Two shapes: with a photograph and without.
            --------------------------------------------------------------- */}
        {settings.heroImageUrl ? (
          <section className="relative">
            <div className="relative h-[72vh] min-h-[480px] w-full overflow-hidden bg-oyster">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.heroImageUrl}
                alt={settings.heroImageCaption || 'A room by Dominate Homes'}
                className="h-full w-full object-cover"
              />
              {/*
                A scrim rather than a flat overlay. The headline has to stay
                readable over a photograph nobody has colour-matched to it,
                and a gradient does that without washing the picture out the
                way a uniform tint does.
              */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/35 to-ink/10" />

              <div className="absolute inset-0 flex items-end">
                <div className="mx-auto w-full max-w-6xl px-6 pb-14 sm:px-10 sm:pb-20">
                  <p className="text-[11px] tracking-[0.2em] text-page/80 uppercase">
                    Chesapeake, Virginia
                  </p>
                  <h1 className="font-display mt-5 max-w-4xl text-[2.6rem] leading-[1.05] text-page sm:text-6xl lg:text-7xl">
                    A finished house, not a folder of ideas.
                  </h1>
                  <p className="mt-6 max-w-xl text-lg leading-[1.7] text-page/90">
                    We furnish new builds end to end, from the empty plan to the day you walk in.
                  </p>

                  <div className="mt-9 flex flex-wrap gap-3">
                    <Link
                      href="#contact"
                      className="rounded-md bg-page px-5 py-2.5 text-ink transition-opacity hover:opacity-90"
                    >
                      Start a project
                    </Link>
                    <Link
                      href="#work"
                      className="rounded-md border border-page/40 px-5 py-2.5 text-page transition-colors hover:bg-page/10"
                    >
                      See the work
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            {settings.heroImageCaption ? (
              <p className="mx-auto max-w-6xl px-6 pt-3 text-sm text-driftwood sm:px-10">
                {settings.heroImageCaption}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mx-auto max-w-6xl px-6 pt-20 pb-20 sm:px-10 sm:pt-32 sm:pb-28">
            <p className="eyebrow">Chesapeake, Virginia</p>
            <h1 className="font-display mt-6 max-w-4xl text-[2.75rem] leading-[1.04] text-ink sm:text-6xl lg:text-7xl">
              A finished house, not a folder of ideas.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-[1.7] text-driftwood-deep">
              We furnish new builds end to end, from the empty plan to the day you walk in. Every
              room costed, every piece measured against the wall it is going on, and every decision
              narrowed to three options so you can actually make it.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="#contact"
                className="rounded-md bg-ink px-5 py-2.5 text-page transition-opacity hover:opacity-90"
              >
                Start a project
              </Link>
              <Link
                href="/signin"
                className="hairline rounded-md border px-5 py-2.5 text-ink transition-colors hover:bg-oyster"
              >
                Client login
              </Link>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------
            What we actually do, in one line each. Specific enough to be
            checkable, which is the only kind of claim worth making.
            --------------------------------------------------------------- */}
        <section className="hairline border-y bg-oyster/50">
          <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-7 px-6 py-12 sm:grid-cols-3 sm:px-10">
            <div>
              <p className="eyebrow">What we do</p>
              <p className="mt-2 leading-relaxed text-driftwood-deep">
                Whole house furnishing and styling for new builds, room by room.
              </p>
            </div>
            <div>
              <p className="eyebrow">When we start</p>
              <p className="mt-2 leading-relaxed text-driftwood-deep">
                Usually before the drywall is up, while the decisions that matter are still cheap.
              </p>
            </div>
            <div>
              <p className="eyebrow">What you get</p>
              <p className="mt-2 leading-relaxed text-driftwood-deep">
                A finished house, and a portal that stays current until the last box is gone.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The work. Hidden entirely until there is something real to show,
            because an empty gallery is worse than no gallery.
            --------------------------------------------------------------- */}
        {projects.length > 0 ? (
          <section id="work" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Our work</h2>
            <p className="mt-2 max-w-2xl text-driftwood-deep">
              Houses we have furnished, and houses we are furnishing now.
            </p>

            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <figure key={project.id}>
                  <div className="photo-frame aspect-[4/5] rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.heroImageUrl ?? ''}
                      alt={project.heroCaption || project.displayName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                    />
                  </div>
                  <figcaption className="mt-4">
                    <h3 className="font-display text-xl leading-snug text-ink">
                      {project.displayName}
                    </h3>
                    <p className="mt-0.5 text-sm text-driftwood">{project.community}</p>
                    {project.siteSummary ? (
                      <p className="mt-2 leading-relaxed text-driftwood-deep">
                        {project.siteSummary}
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : (
          <section id="work" className="sr-only">
            {/*
              The anchor still has to exist, because the nav links to it. An
              invisible target is better than a link that goes nowhere, and far
              better than a visible empty gallery with "coming soon" in it.
            */}
            <h2>Our work</h2>
          </section>
        )}

        {/* ---------------------------------------------------------------
            Something a client said. Hidden until one exists. Never invented.
            --------------------------------------------------------------- */}
        {settings.quote ? (
          <section className="hairline border-y bg-seaglass-wash">
            <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:px-10 sm:py-24">
              <blockquote className="font-display text-2xl leading-[1.45] text-ink sm:text-3xl">
                &ldquo;{settings.quote}&rdquo;
              </blockquote>
              {settings.quoteAttribution ? (
                <p className="mt-6 text-sm tracking-wide text-driftwood">
                  {settings.quoteAttribution}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------------------
            How a project runs.
            --------------------------------------------------------------- */}
        <section id="how" className="hairline border-t bg-oyster/40">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              How a project runs
            </h2>
            <p className="mt-2 max-w-2xl text-driftwood-deep">
              You get a login to your own project from the first week, and it stays current until the
              last box is gone.
            </p>

            <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2">
              {STEPS.map((step) => (
                <div key={step.n} className="flex gap-5">
                  <span className="hairline flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-page font-display text-sm text-seaglass-deep">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl leading-snug text-ink">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-driftwood-deep">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The three rules. The strongest thing on the page, because every
            one of them is enforced rather than promised.
            --------------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
          <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
            Three rules we hold ourselves to
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-driftwood-deep">
            These are not a promise in a brochure. All three are built into the system that runs your
            project, so none of us can quietly bend one on a busy week.
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {RULES.map((rule, index) => (
              <div key={rule.title} className="hairline rounded-xl border bg-page p-6 shadow-sheet">
                <p className="font-display text-lg text-seaglass-deep">0{index + 1}</p>
                <h3 className="font-display mt-2 text-xl leading-snug text-ink">{rule.title}</h3>
                <p className="mt-2 leading-relaxed text-driftwood-deep">{rule.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The portal, which is genuinely unusual for a firm this size.
            --------------------------------------------------------------- */}
        <section className="hairline border-y bg-oyster/40">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              Your project, in one place
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-driftwood-deep">
              Every client gets a portal. It holds the room plans, the three options for each piece,
              what you have approved, where the money has gone, the furniture you are keeping, and
              what is on order. You sign in with a link sent to your email, so there is no password
              to lose.
            </p>
            <ul className="mt-10 grid gap-x-12 gap-y-3.5 text-driftwood-deep sm:grid-cols-2">
              {[
                'Room by room, with real dimensions',
                'Three options per item, priced',
                'Written sign-off before anything orders',
                'Furnishings and our fees kept as separate totals',
                'Your own furniture, placed room by room',
                'Order tracking through to delivery',
                'Send us photos and measurements from your phone',
                'Message us about the house in one thread',
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-seaglass-deep" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Who you are working with.
            --------------------------------------------------------------- */}
        <section id="team" className="mx-auto max-w-6xl px-6 py-24 sm:px-10 sm:py-28">
          <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
            Who you are working with
          </h2>
          <p className="mt-2 max-w-2xl text-driftwood-deep">
            Two people, and you deal with both of us directly. There is no account manager in
            between.
          </p>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {TEAM.map((person) => {
              const photo = settings[person.key]

              return (
                <div key={person.name}>
                  {photo ? (
                    <div className="photo-frame mb-5 aspect-[4/3] rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={person.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <p className="eyebrow">{person.role}</p>
                  <h3 className="font-display mt-1 text-2xl text-ink">{person.name}</h3>
                  <p className="mt-2 leading-relaxed text-driftwood-deep">{person.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------
            The ask. One clear next step, and it is a low commitment one.
            --------------------------------------------------------------- */}
        <section id="contact" className="mx-auto max-w-6xl px-6 pb-8 sm:px-10">
          <div className="hairline rounded-xl border bg-seaglass-wash p-8 sm:p-14">
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              Starting a project
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-driftwood-deep">
              Tell us the plan, the builder and roughly when you close. We will tell you what the
              house needs and what it costs, honestly, before you commit to anything.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/request-access"
                className="rounded-md bg-ink px-5 py-2.5 text-page transition-opacity hover:opacity-90"
              >
                Tell us about your house
              </Link>
              <a
                href="mailto:info@dominatehomes.com"
                className="hairline rounded-md border bg-page px-5 py-2.5 text-ink transition-colors hover:bg-oyster"
              >
                Email us instead
              </a>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-driftwood">
              Already a client?{' '}
              <Link href="/signin" className="text-ink underline underline-offset-2">
                Sign in to your portal
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
