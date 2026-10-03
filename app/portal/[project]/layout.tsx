import Link from 'next/link'
import { AccountMenu } from '@/components/account-menu'
import { BackLink } from '@/components/back-link'
import { Logomark } from '@/components/logo'
import { NavMenu } from '@/components/nav-menu'
import { PortalNav, type PortalSection } from '@/components/portal-nav'
import { ProjectSwitcher } from '@/components/project-switcher'
import { unreadCount } from '@/lib/messages'
import { clientLabelFor, isDesigner, projectsForUser, requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

/**
 * Everything under /portal/[project] is behind sign-in and behind access to
 * that specific project. requireProjectAccess answers not found rather than
 * forbidden for a project the person is not on, so a guessed URL tells them
 * nothing about another client.
 *
 * /, /signin, /healthz and the auth routes sit outside this.
 *
 * The chrome is a top bar and a side list. The bar carries the things that
 * leave where you are (back, the other projects, sign out) and the side list
 * carries the things that move you around inside this project. Keeping those
 * two apart is most of why it is possible to tell where you are.
 */

/** Private. A client's budget has no business in a search index. */
export const metadata = { robots: { index: false, follow: false } }

const SECTIONS: PortalSection[] = [
  { segment: '', label: 'Dashboard' },
  { segment: 'proposal', label: 'Proposal' },
  { segment: 'rooms', label: 'Room by room' },
  { segment: 'budget', label: 'Budget' },
  { segment: 'approvals', label: 'Approvals' },
  { segment: 'pieces', label: 'Your pieces' },
  { segment: 'art', label: 'Art' },
  { segment: 'open-items', label: 'Open items' },
  { segment: 'files', label: 'Files' },
  { segment: 'messages', label: 'Messages' },
  { segment: 'timeline', label: 'Timeline' },
  { segment: 'orders', label: 'Order tracker' },
]

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ project: string }>
}) {
  const { project: slug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, slug)
  const projects = await projectsForUser(user)
  const unread = await unreadCount(user, project.id)

  // Shown to the design side only: these screens talk to the client in the
  // second person, so without this an admin reads "waiting on you" about
  // someone else and has every reason to think the page is broken.
  const viewingAs = isDesigner(user) ? await clientLabelFor(project.id) : null

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-40 border-b bg-page/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-5 sm:px-8">
          <Link
            href="/portal"
            className="flex shrink-0 items-center gap-2.5"
            title="All your projects"
          >
            <Logomark className="w-7 shrink-0 text-ink" title="Dominate Homes" />
            <span className="hidden text-[11px] leading-tight tracking-[0.18em] text-driftwood uppercase md:block">
              Dominate
              <br />
              Homes
            </span>
          </Link>

          <span className="hairline hidden h-7 w-px shrink-0 border-l sm:block" aria-hidden />

          <div className="min-w-0 flex-1">
            <ProjectSwitcher
              current={project}
              projects={projects.map((entry) => ({
                slug: entry.slug,
                displayName: entry.displayName,
                community: entry.community,
              }))}
            />
          </div>

          <BackLink fallbackHref="/portal" className="hidden sm:inline-flex" />

          <AccountMenu name={user.name} email={user.email} isDesigner={isDesigner(user)} />

          {/*
            The sections, on a phone, and the last thing in the bar so it sits
            hard against the right edge. The sidebar carries them from lg up,
            where there is room; under that it wrapped twelve links into a
            block of small targets above every page.
          */}
          <NavMenu
            className="lg:hidden"
            label="Sections"
            links={SECTIONS.map((section) => ({
              href: section.segment ? `/portal/${project.slug}/${section.segment}` : `/portal/${project.slug}`,
              label: section.label,
              exact: section.segment === '',
              count: section.segment === 'messages' ? unread : undefined,
            }))}
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12 lg:px-8">
        <aside className="hidden lg:block lg:w-52 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <PortalNav
              slug={project.slug}
              sections={SECTIONS.map((section) =>
                section.segment === 'messages' ? { ...section, count: unread } : section,
              )}
            />

            <div className="hairline mt-6 hidden border-t pt-4 lg:block">
              <BackLink fallbackHref="/portal" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20">
          {viewingAs ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-clay-wash px-4 py-2.5">
              <p className="text-sm text-clay-deep">
                This is {viewingAs}&rsquo;s view of the project. Anywhere a page says
                &ldquo;you&rdquo;, it means them, not you.
              </p>
              {/*
                A way out that goes somewhere, rather than leaving a designer
                to find the account menu. Reading a project as the client is
                something you do on purpose and then stop doing.
              */}
              <Link
                href={`/admin/projects/${project.slug}`}
                className="shrink-0 text-sm text-clay-deep underline underline-offset-2 hover:text-ink"
              >
                Back to editing it
              </Link>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
