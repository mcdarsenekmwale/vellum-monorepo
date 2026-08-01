-- ============================================================================
-- Final alignment migration: 2 additional indexes declared in schema.prisma
-- @@index([ticketNumber]) on SupportTicket and @@index([isActive]) on TicketAssignment
-- Both CREATE INDEX IF NOT EXISTS for idempotency; data-safe (no data changes).
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='SupportTicket' AND indexname='SupportTicket_ticketNumber_idx') THEN
        CREATE INDEX "SupportTicket_ticketNumber_idx" ON "SupportTicket"("ticketNumber");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='TicketAssignment' AND indexname='TicketAssignment_isActive_idx') THEN
        CREATE INDEX "TicketAssignment_isActive_idx" ON "TicketAssignment"("isActive");
    END IF;
END $$;
