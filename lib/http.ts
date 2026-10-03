import { NextResponse } from 'next/server'

/**
 * Redirects that survive a proxy.
 *
 * Railway terminates TLS at its edge and forwards to the container on
 * localhost:8080, so inside a route handler `request.url` is
 * `http://localhost:8080/...` rather than the address the browser used.
 * Building a redirect from it sent a Location of `http://localhost:8080/portal`,
 * which is a dead page for everyone who is not inside the container. That is
 * what made every emailed sign-in link land nowhere.
 *
 * A relative Location is legal and every browser resolves it against the URL
 * it actually asked for, so this is correct on www, on the apex, and on
 * localhost without the app needing to know its own name. Nothing here reads
 * an environment variable, which is the point: there is no value to get wrong.
 */
export function redirectTo(path: string, status: 303 | 307 = 303): NextResponse {
  // A single leading slash is not enough. `//elsewhere.example/portal` and
  // `/\\elsewhere.example/portal` both begin with one and both are read by
  // browsers as another origin, so letting either through would turn this
  // helper into an open redirect the first time a caller passed something a
  // visitor controls. Every call site today passes a literal; the check is
  // here so that staying safe is not contingent on that.
  const isPath = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')

  if (!isPath) {
    throw new Error(`redirectTo takes a path starting with "/" on this site, not ${path}`)
  }

  return new NextResponse(null, { status, headers: { Location: path } })
}
