-- Add commentsCount column to Article table
ALTER TABLE "Article" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;

-- Add foreign key to Comment table for highlightId
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
