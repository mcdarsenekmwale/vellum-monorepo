-- ============================================================================
-- Final 2 missing indexes from schema.prisma @@index declarations:
--   - RoleAssignmentHistory.createdAt  (schema line 697)
--   - SupportDepartment.key            (schema line 717)
-- Both CREATE INDEX IF NOT EXISTS; data-safe operations.
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='RoleAssignmentHistory' AND indexname='RoleAssignmentHistory_createdAt_idx') THEN
        CREATE INDEX "RoleAssignmentHistory_createdAt_idx" ON "RoleAssignmentHistory"("createdAt");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='SupportDepartment' AND indexname='SupportDepartment_key_idx') THEN
        CREATE INDEX "SupportDepartment_key_idx" ON "SupportDepartment"("key");
    END IF;
END $$;
