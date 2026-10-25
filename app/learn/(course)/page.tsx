import { redirect } from 'next/navigation'
import { COURSES } from '@/lib/course'

export const dynamic = 'force-dynamic'

/**
 * There is one course today, so this goes straight to it. When the team lead
 * course arrives this becomes the list of both.
 */
export default function LearnIndex() {
  redirect(`/learn/${COURSES[0].slug}`)
}
