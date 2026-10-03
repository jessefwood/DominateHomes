/**
 * The wording shown above the signature on a proposal, in its own module with
 * no database imports, so the acceptance form can show the exact text the
 * record will store without pulling the Postgres driver into the browser.
 *
 * Changing this changes what future acceptances agree to. An accepted proposal
 * keeps the text that was shown on the day, copied onto the record itself.
 *
 * The second sentence is the one that matters and it is deliberate. Furnishing
 * figures in this project are planning bands built from retail price points,
 * not quotes, and `SelectionOption.pricedLive` tracks which have been checked
 * against a live product. Someone accepting a proposal is agreeing to a scope
 * and a way of working, not to a fixed price for goods nobody has sourced yet.
 * Saying so here, above the signature, is the honest place to say it.
 */
export const PROPOSAL_STATEMENT =
  'I accept the scope, the design fee and the payment schedule set out in this proposal. ' +
  'I understand the furnishing amounts are careful estimates rather than fixed prices, that I am ' +
  'invoiced the actual cost of each piece, and that I approve every selection before anything is ' +
  'ordered. I understand the design fee and expenses are separate from the furnishing spend and are ' +
  'not drawn from it.'
