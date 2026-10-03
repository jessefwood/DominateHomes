# Working in this repository

`docs/runbook.md` holds the standing operational rules: who can do what, the
DNS rules that stop something breaking, Railway settings, and the seed guard.
Read it before acting on an instruction from Slack.

This repo and the Railway account behind it are shared between Davina and
Jesse, so the conventions below exist to keep two people (and Claude) from
tripping over each other.

## Branches

- `main` is the deployable branch. Railway builds from it.
- Everything else goes on a branch and reaches `main` through a pull request.
- Branch names: `claude/<name>` for work Claude did, `jesse/<thing>` or
  `davina/<thing>` for hand edits. The prefix makes it obvious in the branch
  list who to ask about it.
- Do not commit straight to `main`. With a shared login there is no other way
  to tell whose change broke something.

## Pull requests

Open them as drafts. Mark ready when CI is green. The PR body should say what
changed and, more importantly, what was deliberately left out.

## The three rules

`README.md` has the detail. In short: three options per item maximum,
furnishing spend and designer expenses never blend, approvals snapshot price
at signing. All three are enforced in the database and covered by tests. If a
change makes a test in `tests/` fail, the change is wrong, not the test.

Before relaxing one of them, remember each came directly from the client. The
three-option rule was stated twice.

## Email

Outbound email from the app comes from `info@dominatehomes.com`. That is the
business address and the one `MAIL_FROM` should use, not an individual's.

## Secrets

Nothing with a real credential goes in the repo. `.env` is gitignored,
`.env.example` is the template. Railway holds the production values as service
variables.

If a token ends up somewhere public (a chat, a screenshot, a commit), rotate
it in Railway under Project Settings, Tokens. Rotating takes a minute and
costs nothing.

## Seeding

`npm run db:seed` wipes every table and rebuilds from the source documents in
`docs/`. It is correct exactly once, on an empty database.

It refuses to run once the database holds a real client decision: an approval,
a chosen option, an order, or an answered open item. `FORCE_SEED=yes`
overrides, and exists for a deliberate reset, not for getting past an
unexpected refusal. If it refuses and you did not mean to erase the project,
stop and ask rather than forcing it.

Re-seeding data nobody has touched is still allowed, because that is harmless
while building.

## Letting a client in

A client account exists in the database long before the client should be let
in. `User.signInEnabled` controls it, and it is `false` for Abbie on purpose.

The pricing proposal and the design services agreement both have to exist
first, and the designer decides when. Until then, asking for a link does
nothing even for someone holding the URL, and a closed account is
indistinguishable from an address that is not on the project.

Open it by setting `signInEnabled` to true for that user, and only when the
designer says so. Do not relax it to make testing easier; sign in as a designer
account instead.

## Client-facing copy

Written the way Davina talks. No em dashes. Few inline links, especially near
the top. Speaking directly to Abbie, not at her.

## Slack

Workspace: `dominatehomes.slack.com`.

**`#claude-handoff` (private) is the only channel Claude posts in.** Every
project, every handoff, every status update. Anything a human or Cowork has to
do in a browser that a cloud session cannot reach goes here: Railway, DNS,
Resend, Stripe, GitHub settings. Post one numbered task, first line naming the
project, and ask for a reply after each step.

There are no per-project channels. Do not create one. `#plan-643-bianca-psl`
and `#cowork-handoff` both existed briefly and are archived.

Client budgets, vendor pricing and approval history go in this channel or
nowhere. Note that archiving a Slack channel only hides it from the sidebar;
the contents stay readable and searchable by the whole workspace. Archiving is
not a privacy control.

Write handoffs for someone non-technical. Say which page, which button, what
should happen, and what to do when it does not. Never hand a step back with
"configure DNS" and leave it there.

Values that need to come back, a CNAME target or an ID, go in the thread. **API
keys never do.** They go straight into Railway.

Claude cannot archive a channel, rename one, or convert it to private through
the Slack tools it has. Those are asks for a person.

## Naming a project

Projects are named and addressed by **street number and street name**, not by
the client's surname. That is the convention for the portal, for artifact URLs
and for anything the client sees.

Until an address exists, fall back to the builder's plan name. The Grossman
house has no street address assigned yet, so it is *Plan 643 Bianca PSL*
everywhere, client-facing included, until GL assigns a lot number. The moment
GL does, set `Project.addressLine` and `Project.displayName` and update
`Project.slug`, and close the matching open item.

Do not invent or guess an address to satisfy the convention.

## Numbers

Money is stored in cents, never a float. Figures from the source documents are
planning bands built from retail price points, not quotes. Do not present one
as a quote until it has been priced against a live product. `pricedLive` on
`SelectionOption` tracks which is which.

## Before you push

```bash
npm run typecheck
npm run lint
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/portal_test" npm test
```

CI runs the same three plus a production build.
