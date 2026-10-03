import { ImageResponse } from 'next/og'

/**
 * The image that shows when a link to the site is pasted into a message, a
 * post or an email. Generated rather than a file, so it stays in step with
 * the palette and never goes missing from the repo.
 */

const MARK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18">' +
      '<path d="M1.2 15.8h4.3V9a6.5 6.5 0 0 1 13 0v6.8h4.3" fill="none" stroke="#3b3a34" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  )

export const alt = 'Dominate Homes, furnishing new builds, Chesapeake Virginia'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f2efe6',
          padding: '72px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src={MARK} width={64} height={45} alt="" />
            <div
              style={{
                fontSize: 22,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: '#857f73',
                fontFamily: 'sans-serif',
              }}
            >
              Dominate Homes
            </div>
          </div>
          <div style={{ fontSize: 76, color: '#3b3a34', marginTop: 28, lineHeight: 1.1, maxWidth: 900 }}>
            A finished house, not a folder of ideas.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 28, color: '#5c574d', fontFamily: 'sans-serif', maxWidth: 760 }}>
            Furnishing and styling new builds, room by room
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#95978a' }} />
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#a9694c' }} />
          </div>
        </div>
      </div>
    ),
    size,
  )
}
