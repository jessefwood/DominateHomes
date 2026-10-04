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

## DNS

**Correcting what this file said before.** It stated that DNS lives in Centerfy
(GoHighLevel) and that Cloudflare showing "Invalid nameservers" was expected
because the domain was never delegated there. **That was wrong**, and it sent
two people down the wrong road for an hour. It is recorded rather than quietly
deleted because the way it was wrong is instructive: a vendor panel showing
real records is not proof that the vendor is authoritative.

**The actual picture, from the registry and the delegation:**

    Registrar      Cloudflare, Inc.
    Nameservers    braden.ns.cloudflare.com
                   love.ns.cloudflare.com
    Registered     2024-05-14
    Status         client transfer prohibited

`dominatehomes.com` is **registered at Cloudflare and served by Cloudflare**.
Centerfy is a window onto a zone that lives in a Cloudflare account. It only
ever offered A, CNAME, AAAA, TXT and MX because that is what its panel exposes,
not what the zone supports.

The "Invalid nameservers" warning on Davina's own Cloudflare account was not a
misconfiguration. That account was created on 2026-10-02 and cannot be the one
holding a zone registered on 2024-05-14. Adding the domain there produced a
different nameserver pair, which is why it reads as invalid. **There is no
migration to do and no nameserver change to make.**

**Most likely the Cloudflare account belongs to GoHighLevel, not to anyone at
Dominate Homes.** GHL resells domain registration through Cloudflare, which
explains every observation at once: the registrar is Cloudflare, the zone is on
Cloudflare nameservers, the apex A record is a Cloudflare anycast address, the
Centerfy panel shows the real records, and nobody on the team has a login. The
panel is the intended interface, not a second-class view of someone else's
zone.

**So do not chase Cloudflare access for routine work.** Use the Centerfy panel.
If GHL does hold the registration, that is worth knowing as a business fact,
because whoever holds a registration controls the domain, and it is worth
transferring out eventually. It is not urgent and it blocks nothing.

**The apex redirect therefore goes in Centerfy, not Cloudflare.** GoHighLevel
has a URL Redirect feature: send `dominatehomes.com` to
`https://www.dominatehomes.com`. No root CNAME, no MX conflict, no account
recovery.

`client transfer prohibited` is an ordinary registrar lock. It blocks nothing
we want and should stay on.

**Still true, and the reason for all the caution:** the five Google MX rows are
company email on `info@dominatehomes.com`, which is also the portal's sending
identity. Breaking them stops company email and client logins together.
Screenshot before editing. Never let a "Connect a domain" wizard "resolve
conflicts" on this zone: Centerfy's flow offered to delete all five MX rows and
the SPF row as conflicting.

**The apex.** `dominatehomes.com` has `A @ 162.159.140.166`, a Cloudflare
anycast address, so it already terminates on Cloudflare with a valid
certificate and simply has no rule behind it. The fix is a Cloudflare Redirect
Rule sending `dominatehomes.com/*` to `https://www.dominatehomes.com/$1`. No
CNAME at the apex, no MX conflict, nothing near the Google rows. A root CNAME
is still the wrong answer here and Railway will still ask for one.

**Live record set**, as published:

    A      @                        162.159.140.166
    MX     @                        1 aspmx.l.google.com
    MX     @                        5 alt1.aspmx.l.google.com
    MX     @                        5 alt2.aspmx.l.google.com
    MX     @                        10 alt3.aspmx.l.google.com
    MX     @                        10 alt4.aspmx.l.google.com
    TXT    @                        v=spf1 include:dc-aa8e722993._spfm.dominatehomes.com include:amazonses.com ~all
    TXT    @                        google-site-verification=...
    CNAME  www                      czdhvmac.up.railway.app
    CNAME  project                  1gxax62r.up.railway.app
    CNAME  rsend                    rsend.forge.rmta.net
    CNAME  send                     send.forge.rmta.net
    TXT    _dmarc                   v=DMARC1; p=none
    TXT    dc-aa8e722993._spfm      v=spf1 include:_spf.google.com ~all
    TXT    resend._domainkey        (DKIM)
    TXT    _railway-verify          railway-verify=1329a364...
    TXT    _railway-verify.www      railway-verify=e9fdbbdd...
    TXT    _railway-verify.project  railway-verify=ae2ff4f6...

The site is served from `www.dominatehomes.com`. `portal.dominatehomes.com` is
retired; `APP_URL` was moved to the new host before it was removed, which is
the only safe order, because every outstanding sign-in link points at whatever
`APP_URL` was when it was issued.

`project.dominatehomes.com` is the older Grossman portal, still live on its own
Railway service. Retire it deliberately when that work folds into this app.

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
