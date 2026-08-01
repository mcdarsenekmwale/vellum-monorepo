-- ============================================================================
-- Data-safe alignment migration: add indexes declared in schema.prisma @@index
-- that are missing from the current database. All CREATE INDEX IF NOT EXISTS.
-- No data changes; no destructive operations.
-- ============================================================================

-- ─── RBAC & Permission models ───────────────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='PermissionGroup' AND indexname='PermissionGroup_key_idx') THEN
        CREATE INDEX "PermissionGroup_key_idx" ON "PermissionGroup"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='Permission' AND indexname='Permission_key_idx') THEN
        CREATE INDEX "Permission_key_idx" ON "Permission"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='RbacRole' AND indexname='RbacRole_key_idx') THEN
        CREATE INDEX "RbacRole_key_idx" ON "RbacRole"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='UserPermissionOverride' AND indexname='UserPermissionOverride_expiresAt_idx') THEN
        CREATE INDEX "UserPermissionOverride_expiresAt_idx" ON "UserPermissionOverride"("expiresAt");
    END IF;
END $$;

-- ─── Support Center ─────────────────────────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketCategory' AND indexname='TicketCategory_key_idx') THEN
        CREATE INDEX "TicketCategory_key_idx" ON "TicketCategory"("key");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketStatusHistory' AND indexname='TicketStatusHistory_createdAt_idx') THEN
        CREATE INDEX "TicketStatusHistory_createdAt_idx" ON "TicketStatusHistory"("createdAt");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketMessage' AND indexname='TicketMessage_createdAt_idx') THEN
        CREATE INDEX "TicketMessage_createdAt_idx" ON "TicketMessage"("createdAt");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketTag' AND indexname='TicketTag_name_idx') THEN
        CREATE INDEX "TicketTag_name_idx" ON "TicketTag"("name");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketTagAssignment' AND indexname='TicketTagAssignment_ticketId_idx') THEN
        CREATE INDEX "TicketTagAssignment_ticketId_idx" ON "TicketTagAssignment"("ticketId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketTagAssignment' AND indexname='TicketTagAssignment_tagId_idx') THEN
        CREATE INDEX "TicketTagAssignment_tagId_idx" ON "TicketTagAssignment"("tagId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketInternalNote' AND indexname='TicketInternalNote_authorId_idx') THEN
        CREATE INDEX "TicketInternalNote_authorId_idx" ON "TicketInternalNote"("authorId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketWatcher' AND indexname='TicketWatcher_ticketId_idx') THEN
        CREATE INDEX "TicketWatcher_ticketId_idx" ON "TicketWatcher"("ticketId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketWatcher' AND indexname='TicketWatcher_userId_idx') THEN
        CREATE INDEX "TicketWatcher_userId_idx" ON "TicketWatcher"("userId");
    END IF;
END $$;
