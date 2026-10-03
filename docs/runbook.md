# Runbook

Standing rules for anyone working on this, human or agent. Read this before
acting on instructions in Slack. Slack carries what is new; this carries what
is always true. Where they disagree, this wins unless the Slack message says
it is deliberately changing the rule.

## Who does what

**Claude Code** (cloud session) writes the code, runs the tests, and pushes.
It cannot reach `railway.com`, `slack.com` except through the Slack connector,
or `dominatehomes.com`, because the environment's network policy blocks them.

**Cowork** (on someone's machine) has the browser and the logins. It is good
at verification and at catching things that are wrong in the real world.

**Cowork cannot do any of these.** Do not write tasks that route through it:

- Destructive database commands
- Entering or generating secrets
- Production deploys
- Applying Railway configuration

Those four are human. Write them as instructions for Davina or Jesse with
exact values, and give Cowork the verification afterwards.

## DNS: the rules that stop something breaking

DNS for `dominatehomes.com` lives in **Centerfy (GoHighLevel)**. Not
Cloudflare. Cloudflare shows the domain as "Invalid nameservers" and that is
correct and expected, because it was never delegated there.

**Never change nameservers.**

**Never touch the MX records.** They are five Google rows: the company email
is Gmail, on `info@dominatehomes.com`. That address is also the portal's
sending identity, so every client sign-in link goes out as it. Breaking those
rows stops company email and client logins in one move.

**A root CNAME is not safe on this domain.** A CNAME at the root cannot
coexist with other records for the same name, and this root carries the five
MX rows plus two TXT rows. Railway asks for exactly that when you add the
apex. Use an ALIAS or ANAME if the provider has one, or domain forwarding, but
never a plain CNAME at the root here.

**The SPF record is malformed and should be fixed.** It currently reads:

    v=spf1 include:dc-aa8e722993._spfm.dominatehomes.com ~all include:amazonses.com ~all

SPF is evaluated left to right and `all` always matches, so evaluation stops
at the first `~all`. Everything after it, including `include:amazonses.com`,
is dead. A record may have only one `all`, at the end. The corrected form is:

    v=spf1 include:dc-aa8e722993._spfm.dominatehomes.com include:amazonses.com ~all

This has not broken sign-in links so far because Resend signs with DKIM and
DMARC is `p=none`, so nothing is being rejected. It is still a real
deliverability risk: the thing at stake is a client being unable to log in
because the link went to spam.

Screenshot the zone before editing it.

Railway always needs **two** records for a domain, not one: the CNAME or A
record, plus a `_railway-verify` TXT. The certificate does not issue without
the TXT.

## Railway

There is no `railway.json`. Railway deprecated config-as-code and services
created after 2026-08-28 cannot opt in, so a file in the repo would look
authoritative while doing nothing. Settings are applied by hand:

| Setting | Value |
|---|---|
| Build Command | empty, Railpack detects Next.js |
| Start Command | `npm start` |
| Healthcheck Path | `/healthz` |

`npm start` runs `prisma migrate deploy` before the server, so migrations
apply on every release. A deploy log without that line means either the Start
Command was lost, or the deployed commit predates the fix. Check the second
one first.

**A green deploy proves the build succeeded, not that the intended commit
shipped.** Always check the deployed commit SHA, not the status colour. This
hid a problem for forty minutes: Railway was deploying `main`, every deploy
went green, and `main` had forked before four commits of work. Everything
looked healthy and almost nothing being tested was actually live.

Railway deploys **`main`**. Work lands on a branch and reaches `main` through
a pull request. A fix pushed to a feature branch is not deployed, however
green the last deploy looks.

Required variables: `DATABASE_URL`, `APP_URL`, `MAIL_FROM`, `RESEND_API_KEY`,
`CREDENTIAL_KEY`. Never set `PORT`.

## Do not add --turbopack to the build

`npm run build` is deliberately plain `next build`. A Turbopack production
build breaks progressive enhancement for server actions: a form submitted
before React hydrates returns a 500 with `Cannot read properties of undefined
(reading 'bind')` instead of working.

That matters because the moment it happens is the worst one. A browser holding
a page from before a deploy cannot load the new script chunks, never hydrates,
and the person sees sign-in do nothing at all. Verified both ways on Next
15.5.27: Turbopack 500s, a normal build returns the redirect.

Dev still uses Turbopack, which is fine and fast.

## The database

`npm run db:seed` wipes every table and rebuilds from the source documents. It
is correct exactly once, on an empty database.

It refuses by itself once the database holds a real client decision. **If it
refuses, that is the guard working, not a problem.** `FORCE_SEED=yes` exists
for a deliberate reset and should not be used to get past an unexpected
refusal.

## Letting a client in

`User.signInEnabled` is `false` for a client until the pricing proposal and
the design services agreement exist. While it is false, asking for a sign-in
link does nothing even for someone holding the address.

Opening it is a business decision, not a technical one.

## The three client rules

Three options per item maximum. Furnishing spend and designer expenses never
blend into one total. Approvals snapshot the price at signing.

All three are enforced in the database and covered by tests. A change that
makes a test in `tests/` fail is wrong; the test is not. Each came directly
from the client, and the three-option rule was stated twice.

## Secrets

Nothing with a real credential goes in the repo. Keys live in Railway.
Third party keys entered through `/admin/integrations` are encrypted before
storage under `CREDENTIAL_KEY`.

Never paste a key into Slack. If one ends up somewhere public, roll it at the
provider and enter the new one.

## Before pushing

```bash
npm run typecheck
npm run lint
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/portal_test" npm test
```
