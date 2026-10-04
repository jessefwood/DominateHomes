import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { redirectTo } from '../lib/http'

/**
 * Regression cover for the bug that broke every emailed sign-in link.
 *
 * The routes used to build their redirects with `new URL(path, request.url)`.
 * Railway terminates TLS at its edge and forwards to the container on
 * localhost:8080, so `request.url` inside the handler was
 * `http://localhost:8080/api/auth/verify?...` and the Location header came
 * back as `http://localhost:8080/portal`. The session cookie was set
 * correctly, so the sign-in itself worked and only the landing was broken,
 * which is exactly the kind of failure nobody reads as a bug in the code.
 *
 * The invariant worth holding is narrow: a Location this app sends is a path,
 * never an absolute URL. A path cannot name the wrong host.
 */
describe('redirects behind a proxy', () => {
  it('sends a relative Location, so the browser keeps the host it asked for', () => {
    const location = redirectTo('/portal').headers.get('location')

    assert.equal(location, '/portal')
  })

  it('names no host at all, which is the property that makes it proxy-safe', () => {
    for (const path of ['/portal', '/signin', '/signin?problem=expired']) {
      const location = redirectTo(path).headers.get('location') ?? ''

      assert.equal(location, path)
      assert.ok(!location.includes('://'), `${location} should not carry a scheme`)
      assert.ok(!location.includes('localhost'), `${location} should not carry a host`)
    }
  })

  it('defaults to 303 so a POST sign-out lands as a GET', () => {
    assert.equal(redirectTo('/signin').status, 303)
    assert.equal(redirectTo('/portal', 307).status, 307)
  })

  it('refuses anything that is not a path, including a full URL', () => {
    assert.throws(() => redirectTo('https://evil.example/portal'), /starting with/)
    assert.throws(() => redirectTo('portal'), /starting with/)
    assert.throws(() => redirectTo('//evil.example/portal'), /starting with/)
  })

  it('keeps the cookie API the auth routes depend on', () => {
    const response = redirectTo('/portal')
    response.cookies.set({ name: 'portal_session', value: 'secret', path: '/' })

    assert.match(response.headers.get('set-cookie') ?? '', /portal_session=secret/)
  })
})
