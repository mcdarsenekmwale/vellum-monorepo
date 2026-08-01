-- ============================================================================
-- Idempotent fix for SupportTicket enum column indexes.
-- Migration 9 dropped legacy TEXT status/priority columns (and their indexes)
-- then renamed enum columns (status_new/priority_new → status/priority)
-- but never re-created indexes on the final enum columns.
-- Also adds missing createdAt index for dashboard range queries.
-- ============================================================================

-- Recreate status index on the enum column (was dropped along with the TEXT column)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_status_idx') THEN
        CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
    END IF;
END $$;

-- Recreate priority index on the enum column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_priority_idx') THEN
        CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");
    END IF;
END $$;

-- Add createdAt index for dashboard / timeline queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_createdAt_idx') THEN
        CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
    END IF;
END $$;
