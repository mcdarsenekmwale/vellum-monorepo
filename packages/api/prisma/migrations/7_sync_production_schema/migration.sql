-- Sync production schema with migration history
-- This migration adds columns that exist in production but were missing from earlier migrations
-- All operations are ALTER TABLE only (no DROP/CREATE) to preserve existing data

-- User table: add website and location columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'website') THEN
        ALTER TABLE "User" ADD COLUMN "website" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'location') THEN
        ALTER TABLE "User" ADD COLUMN "location" TEXT;
    END IF;
END $$;

-- Notification table: add metadata, readAt, scheduledFor, updatedAt columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'metadata') THEN
        ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'readAt') THEN
        ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'scheduledFor') THEN
        ALTER TABLE "Notification" ADD COLUMN "scheduledFor" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Notification' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Notification" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AuditLog table: add metadata, changes, success, location columns and index
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'metadata') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'changes') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "changes" JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'success') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'location') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "location" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'AuditLog' AND indexname = 'AuditLog_success_idx'
    ) THEN
        CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");
    END IF;
END $$;

-- Report table: add aiScore, aiCategory columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'aiScore') THEN
        ALTER TABLE "Report" ADD COLUMN "aiScore" INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'aiCategory') THEN
        ALTER TABLE "Report" ADD COLUMN "aiCategory" TEXT;
    END IF;
END $$;
