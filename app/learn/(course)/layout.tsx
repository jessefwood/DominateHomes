import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'
import { AccountMenu } from '@/components/account-menu'
import { Logomark } from '@/components/logo'
import { canOpenCourses } from '@/lib/course'
import { isDesigner } from '@/lib/projects'
import { requireUser } from '@/lib/session'

/**
 * The training course, as an agent reads it.
 *
 * A client who wanders here is sent back to their portal rather than shown a
 * not found, the same courtesy admin gives them. The presenter screen lives
 * outside this layout, under /learn/present, because a shared screen should
 * not have an account menu on it.
 */

export const metadata = { robots: { index: false, follow: false } }

export default async function CourseLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (!canOpenCourses(user)) redirect('/portal')

  return (
    <div className="min-h-screen">
      <header className="hairline sticky top-0 z-50 border-b bg-page/85 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-8">
          <Link href="/learn" className="flex shrink-0 items-center gap-2.5">
            <Logomark className="w-7 shrink-0 text-ink" title="Dominate Homes" />
            <span className="hidden text-[11px] leading-tight tracking-[0.18em] text-driftwood uppercase sm:block">
              Dominate Homes
              <br />
              Training
            </span>
          </Link>

          <div className="flex-1" />

          {isDesigner(user) ? (
            <Link
              href="/admin/course"
              className="hidden rounded-md px-2.5 py-1.5 text-sm text-driftwood-deep hover:bg-oyster sm:block"
            >
              Class roster
            </Link>
          ) : null}

          <AccountMenu
            name={user.name}
            email={user.email}
            isDesigner={isDesigner(user)}
            isAgent={user.role === Role.AGENT}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">{children}</main>
    </div>
  )
}
