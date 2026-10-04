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

/**
 * The sign-in email itself. Written the way Davina talks.
 *
 * NAMES NO PROJECT, DELIBERATELY. It used to, and the project it named was
 * whichever one was created first, for everybody: the oldest row in the whole
 * table, looked up with no reference to who was signing in. So Jesse asked for
 * a link and got an email headed "643 Bianca", which reads as though the
 * portal is one house rather than the business.
 *
 * It was also a small leak. Anybody who could ask for a link was told the name
 * of a project, whether or not they were on it, and that name is a client's
 * address.
 *
 * Signing in is not about a project. It gets you into the portal, and the
 * portal shows you the projects you are on. So there is no project name to
 * pass in here any more, and no way to reintroduce one by accident.
 */
export function signInEmail(to: string, name: string, link: string, minutes: number): Email {
  const firstName = name.split(' ')[0]

  const text = `Hi ${firstName},

Here is your link to open the Dominate Homes portal.

${link}

Once you are in you will see everything we are working on for you, and you can open whichever one you want.

It works once and it expires in ${minutes} minutes. If it has run out, just ask for a new one.

If you did not ask for this, you can ignore it. Nobody can get in without the link.

Davina
Dominate Homes`

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#faf8f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1a17;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(28,26,23,0.12);border-radius:8px;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7f70;">Dominate Homes</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;">Sign in</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName)}, here is your link to open the portal.</p>
      <p style="margin:0 0 20px;">
        <a href="${link}" style="display:inline-block;background:#1c1a17;color:#faf8f4;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:15px;">Open the portal</a>
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Once you are in you will see everything we are working on for you, and you can open whichever one you want.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f564a;">It works once and it expires in ${minutes} minutes. If it has run out, just ask for a new one.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8a7f70;">If you did not ask for this, you can ignore it. Nobody can get in without the link.</p>
    </div>
  </body>
</html>`

  return { to, subject: 'Your link to the Dominate Homes portal', text, html }
}

/**
 * Escaping, for anything in an email that somebody else typed.
 *
 * An email body is markup, and a name or a note can come from the public
 * request form. Angle brackets and quotes out, so nothing anybody types can
 * close a tag and open its own.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The shell every email below sits in, so they look like one another. */
function wrap(heading: string, inner: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#faf8f4;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1a17;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(28,26,23,0.12);border-radius:8px;padding:28px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7f70;">Dominate Homes</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:normal;">${escapeHtml(heading)}</h1>
      ${inner}
    </div>
  </body>
</html>`
}

const BUTTON =
  'display:inline-block;background:#1c1a17;color:#faf8f4;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:15px;'
const BODY = 'margin:0 0 16px;font-size:15px;line-height:1.6;'
const QUIET = 'margin:0;font-size:13px;line-height:1.6;color:#8a7f70;'

/**
 * An invitation to a project.
 *
 * Says what it is for and who it is from, because an email with a link in it
 * from a company somebody spoke to once is otherwise indistinguishable from
 * the thing they have been told never to click.
 */
export function inviteEmail(
  to: string,
  name: string,
  link: string,
  days: number,
  projectName: string,
  invitedBy: string,
): Email {
  const firstName = name.split(' ')[0]

  const text = `Hi ${firstName},

${invitedBy} has set up your portal for ${projectName}.

It has your rooms, what has been picked, where the budget stands and anywhere we are waiting on you. It is also where you can send us photos and videos of the house.

${link}

That link sets up your account and opens the portal. After that you sign in with your email address and we send you a link each time, so there is no password to remember.

It expires in ${days} days. If it has run out, reply to this and we will send another.

Davina
Dominate Homes`

  const html = wrap(
    projectName,
    `<p style="${BODY}">Hi ${escapeHtml(firstName)}, ${escapeHtml(invitedBy)} has set up your portal for ${escapeHtml(projectName)}.</p>
      <p style="${BODY}">It has your rooms, what has been picked, where the budget stands and anywhere we are waiting on you. It is also where you can send us photos and videos of the house.</p>
      <p style="margin:0 0 20px;"><a href="${link}" style="${BUTTON}">Open your portal</a></p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5f564a;">That link sets up your account. After that you sign in with your email address and we send you a link each time, so there is no password to remember.</p>
      <p style="${QUIET}">It expires in ${days} days. If it has run out, reply to this and we will send another.</p>`,
  )

  return { to, subject: `Your ${projectName} portal is ready`, text, html }
}

/** Telling the design side that somebody has asked to be let in. */
export function accessRequestEmail(
  to: string,
  request: { name: string; email: string; phone?: string | null; note?: string | null },
  reviewLink: string,
): Email {
  const lines = [
    `${request.name} has asked for access to the portal.`,
    '',
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    request.phone ? `Phone: ${request.phone}` : null,
    request.note ? `\nWhat they said:\n${request.note}` : null,
    '',
    'Nothing has been granted. Approve or decline it here:',
    reviewLink,
  ].filter((line) => line !== null)

  const html = wrap(
    'Somebody has asked for access',
    `<p style="${BODY}">${escapeHtml(request.name)} has asked for access to the portal. Nothing has been granted.</p>
      <table style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#5f564a;border-collapse:collapse;">
        <tr><td style="padding-right:12px;color:#8a7f70;">Name</td><td>${escapeHtml(request.name)}</td></tr>
        <tr><td style="padding-right:12px;color:#8a7f70;">Email</td><td>${escapeHtml(request.email)}</td></tr>
        ${request.phone ? `<tr><td style="padding-right:12px;color:#8a7f70;">Phone</td><td>${escapeHtml(request.phone)}</td></tr>` : ''}
      </table>
      ${request.note ? `<p style="${BODY}white-space:pre-wrap;">${escapeHtml(request.note)}</p>` : ''}
      <p style="margin:0 0 20px;"><a href="${reviewLink}" style="${BUTTON}">Look at it</a></p>
      <p style="${QUIET}">You get one of these per request. Approving it sends them an invitation.</p>`,
  )

  return {
    to,
    subject: `Access request from ${request.name}`,
    text: lines.join('\n'),
    html,
  }
}

/**
 * Telling the design side a client has sent something.
 *
 * Throttled by the caller to one per person per 15 minutes, because a client
 * uploading eleven photographs of a great room is one event, not eleven. See
 * lib/notify.ts.
 */
export function clientActivityEmail(
  to: string,
  clientName: string,
  projectName: string,
  what: string,
  link: string,
): Email {
  const text = `${clientName} ${what} on ${projectName}.

${link}

You get at most one of these every 15 minutes per person, so there may be more than this waiting.

Dominate Homes`

  const html = wrap(
    projectName,
    `<p style="${BODY}">${escapeHtml(clientName)} ${escapeHtml(what)} on ${escapeHtml(projectName)}.</p>
      <p style="margin:0 0 20px;"><a href="${link}" style="${BUTTON}">Have a look</a></p>
      <p style="${QUIET}">You get at most one of these every 15 minutes per person, so there may be more than this waiting.</p>`,
  )

  return { to, subject: `${clientName} ${what}`, text, html }
}

/**
 * Telling a client there is something waiting for them.
 *
 * One email for the two things the design side does that need an answer: a
 * question put to them, and a message on the thread. Written so it can be read
 * on a phone in ten seconds and acted on, which is the whole job: the thing
 * it replaces is a text message from Davina at nine at night.
 *
 * It deliberately carries the question itself rather than only a link. Most
 * people read the email and nothing else, and a client who can answer in her
 * head before she opens the portal is a client who opens the portal.
 */
export function clientNudgeEmail(
  to: string,
  name: string,
  projectName: string,
  headline: string,
  body: string,
  link: string,
  linkLabel: string,
): Email {
  const firstName = name.split(' ')[0]

  const text = `Hi ${firstName},

${headline}

${body}

${link}

${projectName}
Dominate Homes`

  const html = wrap(
    projectName,
    `<p style="${BODY}">Hi ${escapeHtml(firstName)}, ${escapeHtml(headline)}</p>
      <p style="${BODY}white-space:pre-wrap;">${escapeHtml(body)}</p>
      <p style="margin:0 0 20px;"><a href="${link}" style="${BUTTON}">${escapeHtml(linkLabel)}</a></p>
      <p style="${QUIET}">Replying to this email reaches us too, if that is easier.</p>`,
  )

  return { to, subject: `${headline} · ${projectName}`, text, html }
}
