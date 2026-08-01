-- Final index: HelpArticleVersion.articleId (declared in schema.prisma as implicit FK index,
-- materialized as standalone @@index-equivalent check via migrate diff).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='HelpArticleVersion' AND indexname='HelpArticleVersion_articleId_idx') THEN
        CREATE INDEX "HelpArticleVersion_articleId_idx" ON "HelpArticleVersion"("articleId");
    END IF;
END $$;
