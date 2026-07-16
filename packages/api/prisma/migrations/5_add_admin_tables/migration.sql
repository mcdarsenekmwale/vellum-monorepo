-- CreateTable: Report
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

-- CreateTable: Tag
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeatureFlag
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

-- CreateTable: SystemSetting
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Advertisement
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

-- CreateTable: AIAgent
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

-- CreateTable: BackgroundJob
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

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_status_idx" ON "Report"("status");
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

CREATE INDEX "Advertisement_status_idx" ON "Advertisement"("status");
CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");

CREATE INDEX "AIAgent_status_idx" ON "AIAgent"("status");

CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");
CREATE INDEX "BackgroundJob_queue_idx" ON "BackgroundJob"("queue");
CREATE INDEX "BackgroundJob_ranAt_idx" ON "BackgroundJob"("ranAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default feature flags
INSERT INTO "FeatureFlag" ("id", "key", "description", "enabled", "rollout", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'new_dashboard', 'Enable the new dashboard layout', false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'ai_content_moderation', 'AI-powered content moderation', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'dark_mode_default', 'Default to dark mode for new users', false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'video_highlights', 'Enable video highlights feature', true, 100, NOW(), NOW()),
  (gen_random_uuid(), 'advanced_analytics', 'Show advanced analytics widgets', false, 50, NOW(), NOW()),
  (gen_random_uuid(), 'public_api_v2', 'Enable public API v2 endpoints', false, 0, NOW(), NOW());

-- Seed default system settings
INSERT INTO "SystemSetting" ("id", "key", "value", "category", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'site_name', 'Vellum', 'general', NOW(), NOW()),
  (gen_random_uuid(), 'site_description', 'Platform for creators', 'general', NOW(), NOW()),
  (gen_random_uuid(), 'allow_registrations', 'true', 'auth', NOW(), NOW()),
  (gen_random_uuid(), 'require_email_verification', 'true', 'auth', NOW(), NOW()),
  (gen_random_uuid(), 'max_upload_size_mb', '50', 'uploads', NOW(), NOW()),
  (gen_random_uuid(), 'rate_limit_per_minute', '100', 'security', NOW(), NOW());

-- Seed default AI agents
INSERT INTO "AIAgent" ("id", "name", "description", "model", "status", "runs", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Content Moderator', 'Automatically flags inappropriate content', 'gpt-4', 'idle', 0, NOW(), NOW()),
  (gen_random_uuid(), 'Summary Generator', 'Generates article summaries', 'gpt-4', 'idle', 0, NOW(), NOW()),
  (gen_random_uuid(), 'Tag Suggester', 'Suggests tags for articles', 'gpt-3.5-turbo', 'idle', 0, NOW(), NOW()),
  (gen_random_uuid(), 'Spam Detector', 'Detects and filters spam comments', 'gpt-3.5-turbo', 'idle', 0, NOW(), NOW());

