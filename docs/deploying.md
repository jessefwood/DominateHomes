# Deploying the portal

Target is the Railway project **dominate-homes**, environment **production**
(project ID `93801dc1-516b-40fc-b39b-5fdabdadc50d`), with the app served at
`portal.dominatehomes.com`.

`railway.json` in the repo root already sets the build command, the start
command and the health check, so Railway picks those up on its own.

## 1. Postgres

In the dominate-homes project: **New** then **Database** then **Add
PostgreSQL**. Railway provisions it and exposes `DATABASE_URL` on that
service.

## 2. The app service

**New** then **GitHub Repo** then `jessefwood/DominateHomes`.

Set the deploy branch to `main` under Settings, Source. Railway redeploys on
every push to that branch.

## 3. Variables

On the app service, Variables tab:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `APP_URL` | `https://portal.dominatehomes.com` |
| `MAIL_FROM` | `Davina Hughes <davina@dominatehomes.com>` |
| `RESEND_API_KEY` | from the Resend dashboard |

The `${{Postgres.DATABASE_URL}}` syntax is a Railway reference. It stays
correct if the database is ever rebuilt, so do not paste the literal URL.

Do not set `PORT`. Railway injects it and `next start` reads it.

`APP_URL` is what sign-in links are built from. If it is wrong, the emails
contain links that do not work. The app refuses to start in production without
it, and without both mail variables, rather than printing sign-in links into a
log where they are useless to the client and readable by anyone with log
access.

### Email

Sign-in is by emailed magic link, so mail has to work before anyone can get in.

Resend does not need a separate account for this. Add `dominatehomes.com` as a
sending domain in the existing account, verify it with the DNS records Resend
provides, and create an API key. Only check whether the current plan caps the
number of domains; that is the one thing that would force a second account or
an upgrade.

The DNS records Resend gives you go to Jesse along with the CNAME below. Until
the domain verifies, sign-in emails will not send and nobody can get in.

## 4. Migrations

Nothing to do. `npm run start:prod` runs `prisma migrate deploy` before
starting, so each release applies pending migrations.

The seed does **not** run automatically, which is deliberate. It wipes and
rebuilds every table. To load the initial data once, open a Railway shell on
the app service and run `npm run db:seed`. Never run it again after real
client decisions exist in the database.

## 5. The domain

On the app service: Settings, Networking, **Custom Domain**, enter
`portal.dominatehomes.com`.

Railway returns a CNAME target that looks like
`<something>.up.railway.app`. That exact value is what Jesse needs for the DNS
record:

| Field | Value |
|---|---|
| Type | CNAME |
| Host / Name | `portal` |
| Value | the target Railway shows |
| TTL | default |

DNS for dominatehomes.com is managed wherever the domain's nameservers point.
GHL only controls it if the nameservers point at GHL; otherwise the record
goes in at the registrar. Jesse has been asked which it is.

Watch for a wildcard record (`*.dominatehomes.com`) pointing at the GHL site.
If one exists it will swallow the subdomain, and the explicit `portal` CNAME
needs to win or the wildcard needs removing.

## 6. Checking it worked

`https://portal.dominatehomes.com/healthz` returns `{"ok":true}` when the app
is up and the database is reachable. It does not go through the session, so it
answers even while sign-in is unfinished. Railway uses it as the health check.

## Note on this environment

Claude cannot reach `railway.com` or `backboard.railway.app` from the cloud
session: the environment's network policy denies both. Adding them under
Allowed domains in the environment settings would let Claude do the steps
above directly instead of writing them down.
