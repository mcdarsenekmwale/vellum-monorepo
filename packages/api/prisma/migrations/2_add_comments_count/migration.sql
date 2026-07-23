-- Add commentsCount column to Article table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'commentsCount') THEN
        ALTER TABLE "Article" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add foreign key to Comment table for highlightId (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_highlightId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Comment" ADD CONSTRAINT "Comment_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
