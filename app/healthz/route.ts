import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Deliberately does not go through the session, so a deploy can pass its
 * health check while sign-in is still being wired up. It checks the one thing
 * that actually breaks a deploy: whether the database is reachable.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'database unreachable' }, { status: 503 })
  }
}
