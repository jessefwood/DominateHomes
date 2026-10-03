import { ImageResponse } from 'next/og'

/**
 * The image that shows when a link to the site is pasted into a message, a
 * post or an email. Generated rather than a file, so it stays in step with
 * the palette and never goes missing from the repo.
 */

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
