-- "GL" is what we call the builder between ourselves. On the client's own
-- "What we need from you" list it is shorthand for a name she has never been
-- told, so it reads as a typo. The seed is fixed for the next project; this
-- fixes the row that is already in front of her.
--
-- Matched on the exact old title so it cannot touch an item someone has since
-- reworded, and it is a no-op once applied.
UPDATE "OpenItem"
SET "title" = 'Street address or lot number, once GL Homes assigns it'
WHERE "title" = 'Street address or lot number, once GL assigns it';

-- Same shorthand, and the same problem, on a budget note the client reads.
-- It also told her to check a contract, which is our job and not hers.
UPDATE "BudgetLine"
SET "note" = 'Woven wood shades and ready made panels at this tier. Blinds only, no curtains. Your GL Homes contract may already include basic blinds, and if it does this line drops by about half.'
WHERE "note" = 'Woven wood shades and ready made panels at this tier. Blinds only, no curtains. Check the GL contract first: if the package includes basic blinds this line drops by about half.';
