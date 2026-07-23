-- ============================================================================
-- Idempotent: all CREATE TABLE / CREATE INDEX / ADD CONSTRAINT wrapped in
-- DO $$ ... IF NOT EXISTS ... $$ blocks. Seed INSERTs use WHERE NOT EXISTS.
-- ============================================================================

-- CreateTable: Report
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Report') THEN
        CREATE TABLE "Report" (
            "id" TEXT NOT NULL,
            "targetType" TEXT NOT NULL,
            "targetId" TEXT NOT NULL,
            "reason" TEXT NOT NULL,
            "reporterId" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'open',
            "priority" TEXT NOT NULL DEFAULT 'medium',
            "notes" TEXT,
            "resolvedById" TEXT,
            "resolvedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: Tag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Tag') THEN
        CREATE TABLE "Tag" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: FeatureFlag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'FeatureFlag') THEN
        CREATE TABLE "FeatureFlag" (
            "id" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "enabled" BOOLEAN NOT NULL DEFAULT false,
            "rollout" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: SystemSetting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SystemSetting') THEN
        CREATE TABLE "SystemSetting" (
            "id" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "value" TEXT NOT NULL,
            "category" TEXT NOT NULL DEFAULT 'general',
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: Advertisement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Advertisement') THEN
        CREATE TABLE "Advertisement" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'draft',
            "impressions" INTEGER NOT NULL DEFAULT 0,
            "clicks" INTEGER NOT NULL DEFAULT 0,
            "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "startsAt" TIMESTAMP(3),
            "endsAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: AIAgent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AIAgent') THEN
        CREATE TABLE "AIAgent" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "model" TEXT NOT NULL DEFAULT 'gpt-4',
            "status" TEXT NOT NULL DEFAULT 'idle',
            "runs" INTEGER NOT NULL DEFAULT 0,
            "lastRunAt" TIMESTAMP(3),
            "config" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateTable: BackgroundJob
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BackgroundJob') THEN
        CREATE TABLE "BackgroundJob" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "queue" TEXT NOT NULL DEFAULT 'default',
            "status" TEXT NOT NULL DEFAULT 'pending',
            "duration" INTEGER,
            "error" TEXT,
            "payload" JSONB,
            "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Report_targetType_targetId_idx') THEN
        CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Report_status_idx') THEN
        CREATE INDEX "Report_status_idx" ON "Report"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Report_reporterId_idx') THEN
        CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Report_createdAt_idx') THEN
        CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Tag_name_key') THEN
        CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Tag_slug_key') THEN
        CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Tag_slug_idx') THEN
        CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'FeatureFlag_key_key') THEN
        CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'FeatureFlag_key_idx') THEN
        CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SystemSetting_key_key') THEN
        CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SystemSetting_key_idx') THEN
        CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SystemSetting_category_idx') THEN
        CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Advertisement_status_idx') THEN
        CREATE INDEX "Advertisement_status_idx" ON "Advertisement"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Advertisement_createdAt_idx') THEN
        CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'AIAgent_status_idx') THEN
        CREATE INDEX "AIAgent_status_idx" ON "AIAgent"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'BackgroundJob_status_idx') THEN
        CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'BackgroundJob_queue_idx') THEN
        CREATE INDEX "BackgroundJob_queue_idx" ON "BackgroundJob"("queue");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'BackgroundJob_ranAt_idx') THEN
        CREATE INDEX "BackgroundJob_ranAt_idx" ON "BackgroundJob"("ranAt");
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_reporterId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed default feature flags (idempotent: only insert if key doesn't exist)
INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'new_dashboard', 'Enable the new dashboard layout', false, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'new_dashboard');

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'ai_content_moderation', 'AI-powered content moderation', true, 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'ai_content_moderation');

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'dark_mode_default', 'Default to dark mode for new users', false, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'dark_mode_default');

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'video_highlights', 'Enable video highlights feature', true, 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'video_highlights');

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'advanced_analytics', 'Show advanced analytics widgets', false, 50, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'advanced_analytics');

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'public_api_v2', 'Enable public API v2 endpoints', false, 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'public_api_v2');

-- Seed default system settings (idempotent)
INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'site_name', 'Vellum', 'general', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'site_name');

INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'site_description', 'Platform for creators', 'general', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'site_description');

INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'allow_registrations', 'true', 'auth', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'allow_registrations');

INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'require_email_verification', 'true', 'auth', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'require_email_verification');

INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'max_upload_size_mb', '50', 'uploads', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'max_upload_size_mb');

INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'rate_limit_per_minute', '100', 'security', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'rate_limit_per_minute');

-- Seed default AI agents (idempotent)
INSERT INTO "AIAgent" ("id", "name", "description", "model", "status", "runs", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Content Moderator', 'Automatically flags inappropriate content', 'gpt-4', 'idle', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "AIAgent" WHERE "name" = 'Content Moderator');

INSERT INTO "AIAgent" ("id", "name", "description", "model", "status", "runs", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Summary Generator', 'Generates article summaries', 'gpt-4', 'idle', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "AIAgent" WHERE "name" = 'Summary Generator');

INSERT INTO "AIAgent" ("id", "name", "description", "model", "status", "runs", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Tag Suggester', 'Suggests tags for articles', 'gpt-3.5-turbo', 'idle', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "AIAgent" WHERE "name" = 'Tag Suggester');

INSERT INTO "AIAgent" ("id", "name", "description", "model", "status", "runs", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Spam Detector', 'Detects and filters spam comments', 'gpt-3.5-turbo', 'idle', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "AIAgent" WHERE "name" = 'Spam Detector');
