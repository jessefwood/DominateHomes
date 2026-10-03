import { OrderStatus } from '@prisma/client'
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/money'
import { requireProjectAccess } from '@/lib/projects'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<OrderStatus, string> = {
  ORDERED: 'Ordered',
  ACKNOWLEDGED: 'Confirmed by the vendor',
  IN_TRANSIT: 'On its way',
  RECEIVED: 'Received',
  DAMAGED: 'Arrived damaged',
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ project: string }>
}) {
  const { project: projectSlug } = await params
  const user = await requireUser()
  const project = await requireProjectAccess(user, projectSlug)

  const orders = await prisma.purchaseOrder.findMany({
    where: { selection: { room: { projectId: project.id } } },
    orderBy: { orderedAt: 'desc' },
    include: { selection: { include: { room: { select: { name: true } } } } },
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Order tracker"
        title="What is on order and where it is"
        intro="This fills up once we start buying. Vendors lock their price at the moment they acknowledge an order, not when it ships, which is why the confirmed price gets its own line."
      />

      {orders.length === 0 ? (
        <EmptyState>
          Nothing is on order yet. Ordering starts once rooms are approved, with upholstery going in during
          December so the price is locked before the January reset.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-ink/10">
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{order.selection.name}</p>
                <p className="mt-0.5 text-sm text-driftwood">
                  {order.selection.room.name} · {order.vendor}
                  {order.deliverTo ? ` · delivering to ${order.deliverTo}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-ink tabular-nums">
                  {formatCents(order.acknowledgedPriceCents ?? order.orderedPriceCents)}
                </p>
                <Pill tone={order.status === OrderStatus.DAMAGED ? 'clay' : 'sea'}>
                  {STATUS_COPY[order.status]}
                </Pill>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
