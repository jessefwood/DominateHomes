import type { Block } from '@/lib/course-content'

/**
 * A lesson's blocks, drawn at one of two sizes: the reading size on an
 * agent's page, and the presenting size on Davina's shared screen, where the
 * back row of a Zoom grid has to be able to read it.
 */
export function LessonBlocks({ blocks, size = 'read' }: { blocks: Block[]; size?: 'read' | 'present' }) {
  const big = size === 'present'
  const body = big ? 'text-2xl leading-relaxed sm:text-[28px]' : 'text-[16px] leading-relaxed'
  const gap = big ? 'space-y-7' : 'space-y-4'

  return (
    <div className={`${gap} text-ink`}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'text':
            return (
              <p key={index} className={body}>
                {block.text}
              </p>
            )
          case 'list':
            return (
              <ul key={index} className={`${body} list-disc space-y-2 pl-6 marker:text-seaglass`}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          case 'steps':
            return (
              <ol key={index} className={`${body} list-decimal space-y-2 pl-7 marker:text-seaglass-deep`}>
                {block.items.map((item) => (
                  <li key={item} className="pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            )
          case 'callout':
            return (
              <div
                key={index}
                className={`rounded-xl border-l-4 border-seaglass-deep bg-seaglass-wash ${big ? 'px-8 py-6' : 'px-5 py-4'}`}
              >
                {block.label ? (
                  <p className={`eyebrow text-seaglass-deep ${big ? 'mb-2' : 'mb-1'}`}>{block.label}</p>
                ) : null}
                <p className={`font-display ${big ? 'text-3xl leading-snug sm:text-4xl' : 'text-xl leading-snug'}`}>
                  {block.text}
                </p>
              </div>
            )
          case 'terms':
            return (
              <dl key={index} className={big ? 'space-y-6' : 'space-y-3'}>
                {block.items.map((item) => (
                  <div key={item.term} className={`hairline rounded-lg border ${big ? 'px-7 py-5' : 'px-4 py-3'}`}>
                    <dt className={`font-display ${big ? 'text-3xl' : 'text-lg'} text-ink`}>{item.term}</dt>
                    <dd className={`mt-1 text-driftwood-deep ${big ? 'text-2xl leading-relaxed' : 'text-[15px] leading-relaxed'}`}>
                      {item.meaning}
                    </dd>
                  </div>
                ))}
              </dl>
            )
        }
      })}
    </div>
  )
}
