-- Which instalment a charge is, so reconciling a Stripe payment does not mean
-- comparing amounts and guessing.
CREATE TYPE "PaymentStage" AS ENUM ('DEPOSIT', 'GOODS_1', 'GOODS_2', 'FINAL', 'OTHER');

-- Added with a default so existing rows get a value, then the default is
-- dropped: the Prisma model has none, so a new row has to say which stage it
-- is rather than silently becoming OTHER.
ALTER TABLE "ProposalPayment" ADD COLUMN "stage" "PaymentStage" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "ProposalPayment" ALTER COLUMN "stage" DROP DEFAULT;

-- Traceability from a settled payment back to the exact row it belongs to.
-- Unique, so one Checkout Session can never settle two instalments.
ALTER TABLE "ProposalPayment" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "ProposalPayment" ADD COLUMN "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX "ProposalPayment_stripeSessionId_key" ON "ProposalPayment"("stripeSessionId");
CREATE UNIQUE INDEX "ProposalPayment_stripePaymentIntentId_key" ON "ProposalPayment"("stripePaymentIntentId");
