/**
 * The wording shown above the signature, in its own module with no database
 * imports, so the sign-off form can show the exact text the record will store
 * without dragging the Postgres driver into the browser bundle.
 *
 * Changing this changes what future signatures agree to. Past approvals keep
 * the text that was shown on the day, stored on the record itself.
 */
export const APPROVAL_STATEMENT =
  'I have reviewed the items listed here and I am approving them for order at the prices shown. ' +
  'I understand these prices are the ones recorded today, and that items marked non-returnable are ' +
  'made or cut to order and cannot be returned, exchanged or cancelled once the vendor acknowledges them.'
