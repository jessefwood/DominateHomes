import { ImageResponse } from 'next/og'

/**
 * The home screen icon. Apple ignores SVG favicons, so this one is rendered to
 * a PNG at build time from the same geometry as app/icon.svg. Bigger padding
 * and a larger corner radius than the browser tab icon, because iOS shows it
 * at 180 pixels where the tab shows it at 16.
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3b3a34',
        }}
      >
        <svg width="128" height="91" viewBox="0 0 24 17" fill="none">
          <path
            d="M1.2 15.8h4.3V9a6.5 6.5 0 0 1 13 0v6.8h4.3"
            stroke="#f2efe6"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  )
}
