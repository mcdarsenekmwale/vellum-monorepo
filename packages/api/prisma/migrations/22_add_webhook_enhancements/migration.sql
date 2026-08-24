-- Migration 22: add_webhook_enhancements
-- Data-safe. Preserves existing Webhook rows (2) and WebhookLog rows (15).

-- CreateEnum (missing from auto-diff for the two Webhook enums)
CREATE TYPE "WebhookType" AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE "WebhookFormat" AS ENUM ('JSON', 'FORM', 'XML', 'PLAIN');

-- CreateEnum
CREATE TYPE "WebhookLogType" AS ENUM ('REQUEST', 'RESPONSE', 'ERROR');
CREATE TYPE "TeamsCardType" AS ENUM ('MESSAGE', 'ADAPTIVE');

-- DropForeignKey (we rebuild below with cascade)
ALTER TABLE "WebhookLog" DROP CONSTRAINT IF EXISTS "WebhookLog_webhookId_fkey";

-- AlterTable: Webhook (purely additive + default-bearing columns → safe)
ALTER TABLE "Webhook"
  ADD COLUMN     "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN     "createdBy" TEXT,
  ADD COLUMN     "failureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "format" "WebhookFormat" NOT NULL DEFAULT 'JSON',
  ADD COLUMN     "headers" JSONB,
  ADD COLUMN     "lastTriggeredAt" TIMESTAMP(3),
  ADD COLUMN     "requiresAuth" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN     "retryBackoffDelay" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN     "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN     "teamsCardTemplate" JSONB,
  ADD COLUMN     "teamsCardType" "TeamsCardType" DEFAULT 'MESSAGE',
  ADD COLUMN     "teamsChannelId" TEXT,
  ADD COLUMN     "teamsTeamId" TEXT,
  ADD COLUMN     "type" "WebhookType" NOT NULL DEFAULT 'OUTGOING',
  ALTER COLUMN "secret" DROP NOT NULL,
  ALTER COLUMN "events" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable: WebhookLog — DATA-PRESERVING EDITS BELOW
--
-- RENAME (not drop+add) to keep the 15 existing rows' timestamps + error content
ALTER TABLE "WebhookLog" RENAME COLUMN "createdAt" TO "timestamp";
ALTER TABLE "WebhookLog" RENAME COLUMN "error"     TO "errorMessage";

-- Re-type timestamp from plain TIMESTAMP → TIMESTAMP(3), refresh default to match prisma
ALTER TABLE "WebhookLog"
  ALTER COLUMN "timestamp" TYPE TIMESTAMP(3),
  ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- response: TEXT → JSONB (all 15 rows are NULL → cast safe)
ALTER TABLE "WebhookLog"
  ALTER COLUMN "response" TYPE JSONB USING "response"::jsonb,
  ALTER COLUMN "response" DROP NOT NULL;

-- Additive / nullable-altering changes (no data risk)
ALTER TABLE "WebhookLog"
  ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN     "durationMs" INTEGER,
  ADD COLUMN     "headers" JSONB,
  ADD COLUMN     "type" "WebhookLogType" NOT NULL DEFAULT 'REQUEST',
  ALTER COLUMN "event" DROP NOT NULL,
  ALTER COLUMN "payload" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WebhookTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "type" "WebhookType" NOT NULL DEFAULT 'OUTGOING',
    "format" "WebhookFormat" NOT NULL DEFAULT 'JSON',
    "config" JSONB NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookTemplate_slug_key" ON "WebhookTemplate"("slug");
CREATE INDEX "WebhookTemplate_category_idx" ON "WebhookTemplate"("category");
CREATE INDEX "WebhookTemplate_isActive_idx" ON "WebhookTemplate"("isActive");
CREATE INDEX "WebhookTemplate_slug_idx" ON "WebhookTemplate"("slug");

CREATE INDEX "Webhook_type_idx" ON "Webhook"("type");
CREATE INDEX "Webhook_isActive_idx" ON "Webhook"("isActive");
CREATE INDEX "Webhook_createdBy_idx" ON "Webhook"("createdBy");
CREATE INDEX "Webhook_createdAt_idx" ON "Webhook"("createdAt");

CREATE INDEX "WebhookLog_type_idx" ON "WebhookLog"("type");
CREATE INDEX "WebhookLog_event_idx" ON "WebhookLog"("event");
CREATE INDEX "WebhookLog_timestamp_idx" ON "WebhookLog"("timestamp");
CREATE INDEX "WebhookLog_webhookId_timestamp_idx" ON "WebhookLog"("webhookId", "timestamp");

-- AddForeignKey
ALTER TABLE "WebhookLog"
  ADD CONSTRAINT "WebhookLog_webhookId_fkey"
  FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
