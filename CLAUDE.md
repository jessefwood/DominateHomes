# Working in this repository

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

## Secrets

Nothing with a real credential goes in the repo. `.env` is gitignored,
`.env.example` is the template. Railway holds the production values as service
variables.

If a token ends up somewhere public (a chat, a screenshot, a commit), rotate
it in Railway under Project Settings, Tokens. Rotating takes a minute and
costs nothing.

## Client-facing copy

Written the way Davina talks. No em dashes. Few inline links, especially near
the top. Speaking directly to Abbie, not at her.

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
