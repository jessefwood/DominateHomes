# Plan 643 Bianca PSL client portal

A client portal for the Dominate Homes interior design project at Valencia Parc
at Riverland, Port St. Lucie. Abbie signs in and works through it.

The source of truth for the content is in `docs/`:

- `docs/plan-643-bianca-psl-portal-source.md` — the whole project, with the
  build spec in section 11
- `docs/abbie-sourcing-and-budget.md` — the line-item budget detail

## The three rules

These are structural. They are enforced at the database, not in the UI, and
they have tests. Read this before changing the schema.

### 1. Never more than three options per item

Three layers, outermost first:

| Layer | Where | What stops a fourth |
|---|---|---|
| Database | `OptionSlot` enum plus `@@unique([selectionId, slot])` | The enum has exactly three values and each is unique per item. A fourth row must either reuse a slot or invent a slot value. Postgres rejects both. |
| Types | `OptionSet` in `lib/selections.ts` | A tuple union capped at three. A fourth element does not compile. |
| Write path | `setOptions` / `addOption` | Throws `TooManyOptionsError` with a readable message instead of a constraint stack trace. |

A chosen option is tied to its own item by a composite foreign key
(`Selection.id + chosenSlot` references `SelectionOption.selectionId + slot`),
so a choice can never point at another item's option, and an option a decision
points at cannot be deleted.

### 2. Furnishing spend and the designer's expenses never blend

Every `BudgetLine` carries a required `type` of `FURNISHING` or `EXPENSE` with
no default, so a line cannot be written without declaring its side.

`lib/budget.ts` has no function that returns a combined number and
`BudgetTotals` has no total field. That is deliberate. A test asserts the shape
so that adding one is a visible decision rather than a convenience.

### 3. Approvals snapshot price at signing

`ApprovalLine` copies the name, vendor, unit price, lead time and
non-returnable flag as literal values at the moment of signing. It holds no
foreign key to a live price. `selectionId` is kept for traceability and is
never read to render money. Approvals are written once and never updated: to
change an approved room you sign a new one and the old record stands.

The test that matters moves a vendor price after signing and asserts the
record does not move with it.

## Running it locally

Needs Node 22 and Postgres 16.

```bash
./scripts/dev-db.sh          # starts Postgres on 5433, creates both databases
cp .env.example .env         # then set DATABASE_URL
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Tests run against a separate database:

```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/portal_test" npm test
```

## Screens

| Route | What it does |
|---|---|
| `/` | Dashboard: phase, what is waiting on her, what is waiting on Davina, days to install |
| `/rooms` | Every room with dimensions, tier, contents, budget band and pick status |
| `/rooms/[slug]` | The room, its item list, and the three-slot picker per item |
| `/budget` | Two separate totals, planned, committed, spent and remaining on each |
| `/approvals` | Signed records with frozen prices |
| `/pieces` | The reuse inventory with keep or release and destination room |
| `/art` | Pieces, sizes, reframe status, hanging rules |
| `/open-items` | Her list and Davina's side by side, answered inline |
| `/timeline` | Dated milestones with the December ordering deadline called out |
| `/orders` | Order tracker, fills up once procurement starts |
| `/signin` | Asks for an email and sends a sign-in link |
| `/healthz` | Database reachability, no auth, for the deploy health check |

## Sign-in

Magic link. She puts in her email, gets a link, clicks it, she is in. No
password to remember or reset.

- The emailed token and the session cookie are both random 32-byte secrets.
  Only their SHA-256 hashes are stored, so reading the database does not let
  anyone sign in.
- A link works once, lasts 20 minutes, and redeeming one burns every other
  outstanding link for that account, so a forwarded email cannot be replayed.
- There is no self-signup. An address with no user row gets the same response
  as one that has, and no email. Accounts are created by seed or by hand.
- Requesting a link cannot be used to find out who is on the project.
- Sessions last 30 days in an httpOnly, sameSite lax cookie, secure in
  production.

Everything behind sign-in lives in the `app/(portal)` route group, whose layout
calls `requireUser()`. Pages inside it do not check for themselves. `/signin`,
`/healthz` and the auth routes sit outside the group.

In development, leave `RESEND_API_KEY` unset and links print to the server
console. No email account needed to work on this.

## Loading the three options per item

The options are loaded from a spreadsheet rather than typed into an admin
screen. At one project a year, building a screen to enter fifty items times
three options is a lot of software for a job done once, and a spreadsheet is
the tool the designer already uses.

```bash
npm run db:seed              # once, on an empty database
npm run options:template     # writes options.csv, every item, three rows each
# fill in label, vendor and price; leave a row blank to skip it
npm run options:import       # dry run, reports what it would do
npm run options:import -- --write
```

The importer refuses the whole file if anything is wrong rather than
half-loading it: a fourth option for an item, an unknown reference, a price
that is not a number. Importing an item replaces that item's options rather
than adding to them, which is the only sane behaviour inside a cap of three,
and it clears any pick that pointed at an option being replaced.

## What is not done yet

- **The designer side.** There is no admin UI. Selections, options and order
  status are loaded by seed or by hand.
- **The three options per item.** None are seeded, because none exist yet.
  Every item sits at `PENDING` with three empty slots, which is the real state
  of the project.
- **The expense column.** Seeded with labelled placeholders at zero. No
  designer expense has been quoted, and the design services agreement and
  pricing proposal both need to exist first.

## Content notes

Client-facing copy is written the way Davina talks. No em dashes, few inline
links, speaking directly to Abbie.

The house has no street address assigned. It is referred to as
*Plan 643 Bianca PSL* everywhere, client-facing included.

## Deploying

Configured for Railway in `railway.json`. Needs a Postgres service and
`DATABASE_URL` wired to it. `npm run start:prod` runs `prisma migrate deploy`
before starting, so migrations apply on release.

Step by step, including the custom domain and the DNS record Jesse needs:
`docs/deploying.md`.
