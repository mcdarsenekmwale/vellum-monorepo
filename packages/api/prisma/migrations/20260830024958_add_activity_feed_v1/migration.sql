-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'SHARE';

-- AlterTable
ALTER TABLE "NotificationPreferences"
ADD COLUMN     "groupLikes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "groupComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "groupFollows" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "activityReminderEveryMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expoPushTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "quietHoursStart" VARCHAR(5),
ADD COLUMN     "quietHoursEnd" VARCHAR(5),
ADD COLUMN     "lastActivityNudgeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivityItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "groupingKey" TEXT NOT NULL,
    "actorIds" UUID[] NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "previewText" TEXT,
    "articleSlug" TEXT,
    "highlightId" UUID,
    "commentId" UUID,
    "linkHref" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "latestActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityItem_userId_groupingKey_key" ON "ActivityItem"("userId", "groupingKey");
CREATE INDEX "ActivityItem_userId_idx" ON "ActivityItem"("userId");
CREATE INDEX "ActivityItem_userId_read_idx" ON "ActivityItem"("userId", "read");
CREATE INDEX "ActivityItem_userId_latestActivityAt_idx" ON "ActivityItem"("userId", "latestActivityAt" DESC);

-- AddForeignKey
ALTER TABLE "ActivityItem" ADD CONSTRAINT "ActivityItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
