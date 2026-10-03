import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { AppUrlError, appUrl, appUrlProblem } from '../lib/session'

/**
 * The address sign-in links are built from.
 *
 * THE FAILURE THIS EXISTS FOR, written down because it was live and nobody
 * noticed for hours. Production had APP_URL set to `http://localhost:8080`,
 * which is Railway's own internal address. The code used it verbatim, so every
 * sign-in link the portal emailed pointed at the recipient's own phone, where
 * nothing is listening. Clients got a browser error, assumed they had typed
 * something wrong, and nothing in any log complained, because as far as the
 * code was concerned it had done its job.
 *
 * That is the worst shape a bug can take: the only person who can see it is
 * the one person who cannot fix it, and it looks like their fault.
 *
 * So a base address that cannot work now stops the link being sent. Refusing
 * is worse for one person in the moment and much better overall, because
 * somebody is told, and admin says which variable is wrong.
 */

const saved = { url: process.env.APP_URL, env: process.env.NODE_ENV }

/**
 * NODE_ENV is typed readonly, but these tests are entirely about the
 * production branch, so it has to be set. Assigned through a cast rather than
 * defineProperty, which process.env rejects unless given a full data
 * descriptor.
 */
const env = process.env as Record<string, string | undefined>

function setEnv(name: string) {
  env.NODE_ENV = name
}

function production(value: string | undefined) {
  if (value === undefined) delete process.env.APP_URL
  else process.env.APP_URL = value
  setEnv('production')
}

beforeEach(() => {
  delete process.env.APP_URL
})

afterEach(() => {
  if (saved.url === undefined) delete process.env.APP_URL
  else process.env.APP_URL = saved.url
  setEnv(saved.env ?? 'test')
})

describe('an address that cannot work', () => {
  it('refuses the exact value production had', () => {
    production('http://localhost:8080')

    const problem = appUrlProblem(process.env.APP_URL)
    assert.ok(problem, 'localhost:8080 was accepted')
    assert.match(problem, /do not work on anybody else/i)
    assert.throws(() => appUrl(), AppUrlError)
  })

  it('refuses every other way of saying this machine', () => {
    for (const host of [
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'https://0.0.0.0',
      'http://[::1]:8080',
    ]) {
      production(host)
      assert.ok(appUrlProblem(host), `${host} was accepted`)
    }
  })

  it('refuses something that is not a web address at all', () => {
    production('www.dominatehomes.com')
    assert.match(appUrlProblem('www.dominatehomes.com') ?? '', /not a web address/i)

    production('javascript:alert(1)')
    assert.match(appUrlProblem('javascript:alert(1)') ?? '', /not an http or https/i)
  })

  it('refuses an empty one', () => {
    production(undefined)
    assert.match(appUrlProblem(undefined) ?? '', /not set/i)
    assert.throws(() => appUrl(), AppUrlError)
  })

  it('names the variable and the value, so the message is actionable', () => {
    // Whoever reads this is looking at a Railway settings screen. "Invalid
    // configuration" would send them hunting.
    production('http://localhost:8080')
    const problem = appUrlProblem('http://localhost:8080') ?? ''
    assert.match(problem, /APP_URL/)
    assert.match(problem, /localhost:8080/)
    assert.match(problem, /dominatehomes\.com/)
  })
})

describe('an address that works', () => {
  it('accepts the real one', () => {
    production('https://www.dominatehomes.com')

    assert.equal(appUrlProblem(process.env.APP_URL), null)
    assert.equal(appUrl(), 'https://www.dominatehomes.com')
  })

  it('drops a trailing slash, so links do not come out doubled', () => {
    production('https://www.dominatehomes.com/')
    assert.equal(appUrl(), 'https://www.dominatehomes.com')
  })

  it('still allows localhost while developing', () => {
    // The check is about production. Blocking localhost everywhere would mean
    // nobody could work on sign-in on their own machine.
    setEnv('development')
    process.env.APP_URL = 'http://localhost:3100'

    assert.equal(appUrlProblem('http://localhost:3100'), null)
    assert.equal(appUrl(), 'http://localhost:3100')
  })

  it('falls back to a local address when nothing is set in development', () => {
    setEnv('development')
    delete process.env.APP_URL

    assert.equal(appUrl(), 'http://localhost:3000')
  })
})
