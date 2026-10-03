import type { NextConfig } from 'next'

/**
 * Security headers.
 *
 * Applied to every response, including the public pages, because none of
 * these cost anything there and a header that is only on some routes is one
 * nobody can reason about.
 *
 * WHAT IS NOT HERE, AND WHY. There is no `serverActions.allowedOrigins`.
 * Next already refuses a server action whose Origin does not match its Host,
 * which is the cross-site request protection this application needs, and
 * `allowedOrigins` only ever widens that. Adding it would be writing down a
 * list of extra origins allowed to post to our forms, which is the opposite
 * of the intention. The session cookie is `sameSite: lax` as well, so a
 * cross-site form post does not carry it in the first place.
 *
 * ON THE CONTENT SECURITY POLICY. `script-src` includes `'unsafe-inline'`,
 * and it has to: Next inlines its own bootstrap and hydration scripts, and
 * the way to avoid that is a per-request nonce threaded through middleware.
 * That is worth doing and it is not worth doing at the same time as
 * everything else, because getting it wrong takes the whole site down rather
 * than degrading. So be clear about what this policy is and is not:
 *
 *   It does NOT stop an inline script that is already on the page. The
 *   defence against that is that nothing in this application renders
 *   anybody's text as markup. Messages, captions and request notes are all
 *   drawn as text, pasted links are checked for their protocol, and SVG
 *   uploads are refused.
 *
 *   It DOES stop a script loaded from somewhere else, a page of ours being
 *   framed, a form being pointed at another host, a plugin being embedded,
 *   and `<base>` being rewritten. Those are real and this closes them.
 */

const CSP = [
  "default-src 'self'",
  // Next inlines its bootstrap. See the note above.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind generates inline style attributes, and so do the progress bars.
  "style-src 'self' 'unsafe-inline'",
  // Fonts are self-hosted through next/font, so nothing external is needed.
  "font-src 'self'",
  // Photographs are vendor product pages, the builder's site, Davina's Drive
  // and now our own bucket. The hosts cannot be enumerated ahead of time,
  // which is the same reason these render through a plain img tag rather than
  // next/image. `blob:` is for the local preview of a file being uploaded.
  "img-src 'self' https: data: blob:",
  // Video walkthroughs stream from the bucket through a redirect.
  "media-src 'self' https: blob:",
  // An upload PUTs straight to the storage host from the browser.
  "connect-src 'self' https:",
  // Nothing here is ever framed, and there is nothing to frame.
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // A form on our pages can only post back to us.
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

const HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // Older browsers, and belt and braces behind frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  // A file the bucket calls text/plain must not be sniffed into HTML.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A portal URL carries a project slug. Other sites do not need it.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here wants a camera, a microphone or a location.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Two years, subdomains included. Railway terminates TLS at its edge and
  // serves this site on https only; a browser on plain http ignores it, so it
  // is harmless in development.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // Keeps this origin out of other tabs' reach.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: HEADERS }]
  },
}

export default nextConfig
