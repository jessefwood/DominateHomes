-- Photographs, and a place for Davina's own notes.
--
-- All nullable and all additive: nothing existing has a picture, and a project
-- or a room without one has to keep rendering exactly as it did.

ALTER TABLE "Project" ADD COLUMN "heroImageUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN "heroCaption" TEXT;
ALTER TABLE "Project" ADD COLUMN "designerNote" TEXT;

ALTER TABLE "Room" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Room" ADD COLUMN "photoCaption" TEXT;
