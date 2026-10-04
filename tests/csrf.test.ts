import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NextRequest } from 'next/server'
import { sameOrigin } from '../lib/csrf'

/**
 * The second lock on the one route handler that changes something.
 *
 * The first lock is the session cookie being `sameSite: lax`, which means a
 * cross-site POST does not carry it. This exists because that is a browser's
 * promise rather than ours.
 *
 * The case worth keeping in mind while reading these: Railway terminates TLS
 * at its edge and forwards to the container on localhost:8080, so the request
 * URL inside a handler is not the address the browser used. The forwarded
 * host is, which is why that is what gets compared.
 */

function post(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:8080/api/auth/signout', { method: 'POST', headers })
}

describe('deciding a request came from our own pages', () => {
  it('accepts a form post from the site itself', () => {
    assert.equal(
      sameOrigin(
        post({
          origin: 'https://portal.dominatehomes.com',
          'x-forwarded-host': 'portal.dominatehomes.com',
        }),
      ),
      true,
    )
  })

  it('accepts one in development, where there is no proxy in front', () => {
    assert.equal(
      sameOrigin(post({ origin: 'http://localhost:3000', host: 'localhost:3000' })),
      true,
    )
  })

  it('reads the forwarded host rather than the one inside the container', () => {
    // Without this the comparison would be against localhost:8080, which is
    // what Railway forwards to, and every real sign-out would be refused.
    assert.equal(
      sameOrigin(
        post({
          origin: 'https://portal.dominatehomes.com',
          'x-forwarded-host': 'portal.dominatehomes.com',
          host: 'localhost:8080',
        }),
      ),
      true,
    )
  })

  it('refuses another site', () => {
    assert.equal(
      sameOrigin(
        post({ origin: 'https://evil.example', 'x-forwarded-host': 'portal.dominatehomes.com' }),
      ),
      false,
    )
  })

  it('refuses a lookalike host', () => {
    assert.equal(
      sameOrigin(
        post({
          origin: 'https://portal.dominatehomes.com.evil.example',
          'x-forwarded-host': 'portal.dominatehomes.com',
        }),
      ),
      false,
    )
  })

  it('refuses a request with no origin at all', () => {
    assert.equal(sameOrigin(post({ 'x-forwarded-host': 'portal.dominatehomes.com' })), false)
  })

  it('refuses nonsense in the origin header', () => {
    assert.equal(
      sameOrigin(post({ origin: 'not a url', 'x-forwarded-host': 'portal.dominatehomes.com' })),
      false,
    )
  })

  it('refuses when there is no host to compare against', () => {
    assert.equal(sameOrigin(post({ origin: 'https://portal.dominatehomes.com' })), false)
  })
})
