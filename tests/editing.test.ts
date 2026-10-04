import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EditError,
  centsToInput,
  moneyToCents,
  optionalMoneyToCents,
  optionalText,
  optionalUrl,
  optionalWholeNumber,
  requiredText,
} from '../lib/editing'

/**
 * The admin screens are typed into by a person, so these take whatever a
 * person types. Two of the properties below are not conveniences though, and
 * are the reason this file exists:
 *
 *   Money never becomes a float. A price typed as 1250.10 has to come out as
 *   125010 cents exactly, because the three rules are enforced on integers and
 *   a cent of float drift makes an approval snapshot disagree with the price
 *   that was approved.
 *
 *   A pasted link cannot carry a script. These fields are written by Davina
 *   and rendered to the client as an href and an img src, which is a stored
 *   cross-site scripting hole if `javascript:` gets through.
 */

function problem(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    assert.ok(error instanceof EditError, `threw something that is not an EditError: ${error}`)
    return error.message
  }
  assert.fail('expected that to be rejected')
}

describe('money typed by a person', () => {
  it('reads a plain amount as cents', () => {
    assert.equal(moneyToCents('1250', 'Price'), 125000)
    assert.equal(moneyToCents('1250.00', 'Price'), 125000)
    assert.equal(moneyToCents('1250.1', 'Price'), 125010)
    assert.equal(moneyToCents('1250.10', 'Price'), 125010)
    assert.equal(moneyToCents('0.07', 'Price'), 7)
  })

  it('forgives the dollar sign, the commas and the spaces', () => {
    assert.equal(moneyToCents(' $1,250.99 ', 'Price'), 125099)
    assert.equal(moneyToCents('$47,100', 'Price'), 4710000)
  })

  // The point of storing cents. 1250.10 through parseFloat and *100 is
  // 125009.99999999999, which floors to a cent less than was typed.
  it('never loses a cent to a float', () => {
    for (const [typed, cents] of [
      ['1250.10', 125010],
      ['0.29', 29],
      ['19.99', 1999],
      ['1.03', 103],
      ['123456.78', 12345678],
    ] as const) {
      assert.equal(moneyToCents(typed, 'Price'), cents, typed)
    }
  })

  it('says so rather than rounding a third decimal away', () => {
    assert.match(problem(() => moneyToCents('10.005', 'Price')), /only two of them/)
  })

  it('rejects what is not an amount at all', () => {
    for (const bad of ['ten dollars', '1,2,3.4.5', '-50', '1e5', 'NaN']) {
      problem(() => moneyToCents(bad, 'Price'))
    }
  })

  it('round trips through the input box', () => {
    for (const cents of [0, 7, 1999, 125010, 4710000]) {
      assert.equal(moneyToCents(centsToInput(cents), 'Price'), cents)
    }
  })

  it('treats an empty optional amount as nothing to store', () => {
    assert.equal(optionalMoneyToCents('', 'Price'), null)
    assert.equal(optionalMoneyToCents('   ', 'Price'), null)
    assert.equal(optionalMoneyToCents('12', 'Price'), 1200)
  })

  it('shows nothing in the box for an amount that is not set', () => {
    assert.equal(centsToInput(null), '')
    assert.equal(centsToInput(undefined), '')
    assert.equal(centsToInput(0), '0.00')
  })
})

describe('a link somebody pasted', () => {
  it('keeps an ordinary https link', () => {
    assert.equal(
      optionalUrl('https://example.invalid/sofa.jpg', 'Photo'),
      'https://example.invalid/sofa.jpg',
    )
  })

  it('trims the whitespace a copy and paste brings along', () => {
    assert.equal(optionalUrl('  https://example.invalid/a.png  ', 'Photo'), 'https://example.invalid/a.png')
  })

  it('treats an empty box as clearing the picture', () => {
    assert.equal(optionalUrl('', 'Photo'), null)
    assert.equal(optionalUrl('   ', 'Photo'), null)
    assert.equal(optionalUrl(undefined, 'Photo'), null)
  })

  // THE ONE THAT MATTERS. These values are rendered to the client as an href
  // and an img src.
  it('refuses a scheme that can run something', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      problem(() => optionalUrl(bad, 'Photo'))
    }
  })

  it('refuses something that is not a web address', () => {
    assert.match(problem(() => optionalUrl('not a url', 'Photo')), /web address/)
    assert.match(problem(() => optionalUrl('example.invalid/a.jpg', 'Photo')), /web address/)
  })
})

describe('text and whole numbers', () => {
  it('turns an empty box back into nothing stored', () => {
    assert.equal(optionalText(''), null)
    assert.equal(optionalText('  '), null)
    assert.equal(optionalText(undefined), null)
    assert.equal(optionalText('  a note  '), 'a note')
  })

  it('will not let a required field be emptied', () => {
    assert.match(problem(() => requiredText('   ', 'The room name')), /The room name cannot be empty/)
  })

  it('reads a count, and refuses one with letters in it', () => {
    assert.equal(optionalWholeNumber('4', 'How many'), 4)
    assert.equal(optionalWholeNumber('', 'How many'), null)
    assert.match(problem(() => optionalWholeNumber('4 of them', 'How many')), /whole number/)
    assert.match(problem(() => optionalWholeNumber('2.5', 'How many')), /whole number/)
  })
})
