-- A photograph of each piece of art. Nullable and additive, like the rest.

ALTER TABLE "ArtPiece" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "ArtPiece" ADD COLUMN "photoCaption" TEXT;
