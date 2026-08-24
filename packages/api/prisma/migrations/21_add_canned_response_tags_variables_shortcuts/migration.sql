-- Add tags, variables, and shortcuts array columns to CannedResponse table
ALTER TABLE "CannedResponse" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CannedResponse" ADD COLUMN "variables" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CannedResponse" ADD COLUMN "shortcuts" TEXT[] DEFAULT ARRAY[]::TEXT[];
