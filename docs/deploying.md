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
| `ALLOW_PLACEHOLDER_AUTH` | `yes` — **temporary, see below** |

The `${{Postgres.DATABASE_URL}}` syntax is a Railway reference. It stays
correct if the database is ever rebuilt, so do not paste the literal URL.

Do not set `PORT`. Railway injects it and `next start` reads it.

### About that second variable

`lib/session.ts` is a placeholder that authenticates nobody. A production
build refuses to start without this flag, which is the point: it cannot ship
by accident.

Setting it means **anyone with the URL sees the whole project, including the
budget**. That is survivable while the only person with the URL is us. It is
not survivable once the link is sent to Abbie. Delete this variable the day
real sign-in lands, and do not send her the link before then.

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
