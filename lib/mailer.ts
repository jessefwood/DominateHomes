/**
 * Sending sign-in links.
 *
 * Deliberately an interface with two implementations rather than a direct call
 * to a provider. Development needs no email account at all, and swapping Resend
 * for SMTP or anything else later is one file, not a hunt through the codebase.
 */

export type Email = {
  to: string
  subject: string
  text: string
  html: string
}

export interface Mailer {
  send(email: Email): Promise<void>
}

/**
 * Development. Prints the link to the server console instead of sending it.
 * Nobody needs an API key to work on this locally.
 */
export class ConsoleMailer implements Mailer {
  async send(email: Email): Promise<void> {
    const link = email.text.match(/https?:\/\/\S+/)?.[0]
    console.log('\n──────────────────────────────────────────')
    console.log(`Sign-in email for ${email.to}`)
    console.log(`Subject: ${email.subject}`)
    if (link) console.log(`\nLink: ${link}\n`)
    console.log('──────────────────────────────────────────\n')
  }
}

export class MailerError extends Error {}

/** Production. https://resend.com */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(email: Email): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    })

    if (!response.ok) {
      // The body carries the real reason, usually an unverified sending domain.
      const detail = await response.text().catch(() => '')
      throw new MailerError(`Resend refused the message (${response.status}). ${detail}`)
    }
  }
}

let cached: Mailer | undefined

export function mailer(): Mailer {
  if (cached) return cached

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM

  if (apiKey && from) {
    cached = new ResendMailer(apiKey, from)
    return cached
  }

  if (process.env.NODE_ENV === 'production') {
    // Failing here beats silently printing a sign-in link into a production
    // log where it is both useless to the client and readable by anyone with
    // log access.
    throw new MailerError(
      'RESEND_API_KEY and MAIL_FROM must both be set in production. ' +
        'Without them there is no way to deliver a sign-in link.',
    )
  }

  cached = new ConsoleMailer()
  return cached
}

/** The sign-in email itself. Written the way Davina talks. */
export function signInEmail(
  to: string,
  name: string,
  link: string,
  minutes: number,
  projectName: string,
): Email {
  const firstName = name.split(' ')[0]

  const text = `Hi ${firstName},

Here is your link to open the ${projectName} portal.

${link}

It works once and it expires in ${minutes} minutes. If it has run out, just ask for a new one.

If you did not ask for this, you can ignore it. Nobody can get in without the link.

Davina
Dominate Homes`

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#faf8f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1a17;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(28,26,23,0.12);border-radius:8px;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7f70;">Dominate Homes</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;">${projectName}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${firstName}, here is your link to open the portal.</p>
      <p style="margin:0 0 20px;">
        <a href="${link}" style="display:inline-block;background:#1c1a17;color:#faf8f4;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:15px;">Open the portal</a>
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f564a;">It works once and it expires in ${minutes} minutes. If it has run out, just ask for a new one.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8a7f70;">If you did not ask for this, you can ignore it. Nobody can get in without the link.</p>
    </div>
  </body>
</html>`

  return { to, subject: `Your link to the ${projectName} portal`, text, html }
}
