-- ============================================================================
-- Last 3 missing indexes from schema.prisma @@index declarations:
--   - ActivityLog.createdAt      (line 355)
--   - CannedResponse.category    (line 431)
--   - CannedResponse.shortcut    - @unique already, but schema has @@index alias too
-- All CREATE INDEX IF NOT EXISTS; data-safe, no data modifications.
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='ActivityLog' AND indexname='ActivityLog_createdAt_idx') THEN
        CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='CannedResponse' AND indexname='CannedResponse_category_idx') THEN
        CREATE INDEX "CannedResponse_category_idx" ON "CannedResponse"("category");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='CannedResponse' AND indexname='CannedResponse_shortcut_idx') THEN
        CREATE INDEX "CannedResponse_shortcut_idx" ON "CannedResponse"("shortcut");
    END IF;
END $$;
