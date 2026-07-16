-- ============================================================================
-- Comprehensive Sync Migration
-- Idempotent migration that brings ANY database in sync with the Prisma schema.
-- All operations are wrapped in DO $$ ... BEGIN ... IF NOT EXISTS ... $$ blocks
-- so the migration can be safely re-run on any database state.
-- ============================================================================

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS "public";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('ADMIN', 'MODERATOR', 'CREATOR', 'USER', 'GUEST');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationKind') THEN
        CREATE TYPE "NotificationKind" AS ENUM ('LIKE', 'COMMENT', 'REPLY', 'FOLLOW', 'BOOKMARK', 'MENTION', 'SYSTEM');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaType') THEN
        CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');
    END IF;
END $$;

-- ============================================================================
-- TABLES (created IF NOT EXISTS)
-- ============================================================================

-- User
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
        CREATE TABLE "User" (
            "id" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "emailVerified" TIMESTAMP(3),
            "passwordHash" TEXT NOT NULL,
            "handle" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "avatar" TEXT,
            "bio" TEXT,
            "website" TEXT,
            "location" TEXT,
            "publication" TEXT,
            "role" "Role" NOT NULL DEFAULT 'USER',
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "User_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- UserSettings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'UserSettings') THEN
        CREATE TABLE "UserSettings" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
            "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
            "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
            "allowComments" BOOLEAN NOT NULL DEFAULT true,
            "allowLikes" BOOLEAN NOT NULL DEFAULT true,
            "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Article
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Article') THEN
        CREATE TABLE "Article" (
            "id" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "excerpt" TEXT NOT NULL,
            "body" TEXT[],
            "cover" TEXT,
            "readMinutes" INTEGER NOT NULL,
            "categoryId" TEXT NOT NULL,
            "authorId" TEXT NOT NULL,
            "likesCount" INTEGER NOT NULL DEFAULT 0,
            "views" INTEGER NOT NULL DEFAULT 0,
            "featured" BOOLEAN NOT NULL DEFAULT false,
            "isPublished" BOOLEAN NOT NULL DEFAULT false,
            "publishedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "deletedAt" TIMESTAMP(3),
            "commentsCount" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Highlight
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Highlight') THEN
        CREATE TABLE "Highlight" (
            "id" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "cover" TEXT,
            "videoUrl" TEXT,
            "thumbnailUrl" TEXT,
            "handle" TEXT NOT NULL,
            "authorId" TEXT,
            "likesCount" INTEGER NOT NULL DEFAULT 0,
            "commentsCount" INTEGER NOT NULL DEFAULT 0,
            "shares" INTEGER NOT NULL DEFAULT 0,
            "description" TEXT,
            "music" TEXT,
            "aspectRatio" DOUBLE PRECISION DEFAULT 1.777,
            "duration" INTEGER,
            "isPublished" BOOLEAN NOT NULL DEFAULT false,
            "publishedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Story
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Story') THEN
        CREATE TABLE "Story" (
            "id" TEXT NOT NULL,
            "authorId" TEXT NOT NULL,
            "image" TEXT NOT NULL,
            "caption" TEXT,
            "duration" INTEGER NOT NULL DEFAULT 5000,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '24:00:00'::interval),
            CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- StoryView
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'StoryView') THEN
        CREATE TABLE "StoryView" (
            "id" TEXT NOT NULL,
            "storyId" TEXT NOT NULL,
            "viewerId" TEXT NOT NULL,
            "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Comment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Comment') THEN
        CREATE TABLE "Comment" (
            "id" TEXT NOT NULL,
            "articleSlug" TEXT,
            "highlightId" TEXT,
            "authorId" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "parentId" TEXT,
            "likesCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Category
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Category') THEN
        CREATE TABLE "Category" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "tint" TEXT NOT NULL DEFAULT '#e5e5e5',
            "slug" TEXT NOT NULL,
            CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Like
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Like') THEN
        CREATE TABLE "Like" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "articleSlug" TEXT,
            "highlightId" TEXT,
            "commentId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Bookmark
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Bookmark') THEN
        CREATE TABLE "Bookmark" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "articleSlug" TEXT,
            "highlightId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Follow
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Follow') THEN
        CREATE TABLE "Follow" (
            "id" TEXT NOT NULL,
            "followerId" TEXT NOT NULL,
            "followingId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Notification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Notification') THEN
        CREATE TABLE "Notification" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "actorId" TEXT,
            "kind" "NotificationKind" NOT NULL,
            "articleSlug" TEXT,
            "highlightId" TEXT,
            "commentId" TEXT,
            "body" TEXT,
            "metadata" JSONB,
            "read" BOOLEAN NOT NULL DEFAULT false,
            "readAt" TIMESTAMP(3),
            "scheduledFor" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- RefreshToken
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'RefreshToken') THEN
        CREATE TABLE "RefreshToken" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "token" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "deviceInfo" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Session
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Session') THEN
        CREATE TABLE "Session" (
            "id" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "sessionToken" TEXT NOT NULL,
            "expiresAt" TIMESTAMP(3) NOT NULL,
            "deviceInfo" TEXT,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Media
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Media') THEN
        CREATE TABLE "Media" (
            "id" TEXT NOT NULL,
            "filename" TEXT NOT NULL,
            "originalName" TEXT NOT NULL,
            "mimeType" TEXT NOT NULL,
            "size" INTEGER NOT NULL,
            "type" "MediaType" NOT NULL,
            "url" TEXT NOT NULL,
            "thumbnailUrl" TEXT,
            "width" INTEGER,
            "height" INTEGER,
            "metadata" JSONB,
            "uploadedBy" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3),
            CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Webhook
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Webhook') THEN
        CREATE TABLE "Webhook" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "url" TEXT NOT NULL,
            "secret" TEXT NOT NULL,
            "events" TEXT[],
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- WebhookLog
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WebhookLog') THEN
        CREATE TABLE "WebhookLog" (
            "id" TEXT NOT NULL,
            "webhookId" TEXT NOT NULL,
            "event" TEXT NOT NULL,
            "payload" JSONB NOT NULL,
            "statusCode" INTEGER,
            "response" TEXT,
            "error" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- AuditLog
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLog') THEN
        CREATE TABLE "AuditLog" (
            "id" TEXT NOT NULL,
            "userId" TEXT,
            "action" TEXT NOT NULL,
            "resource" TEXT NOT NULL,
            "resourceId" TEXT,
            "details" JSONB,
            "metadata" JSONB,
            "changes" JSONB,
            "success" BOOLEAN NOT NULL DEFAULT true,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "location" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- ApiKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ApiKey') THEN
        CREATE TABLE "ApiKey" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "userId" TEXT,
            "scopes" TEXT[],
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "expiresAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastUsedAt" TIMESTAMP(3),
            CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Report
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
            "aiScore" INTEGER,
            "aiCategory" TEXT,
            "notes" TEXT,
            "resolvedById" TEXT,
            "resolvedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Tag
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

-- FeatureFlag
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

-- SystemSetting
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

-- Advertisement
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

-- AIAgent
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

-- BackgroundJob
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

-- HelpArticle
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'HelpArticle') THEN
        CREATE TABLE "HelpArticle" (
            "id" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "content" TEXT[],
            "category" TEXT NOT NULL,
            "icon" TEXT NOT NULL,
            "readMinutes" INTEGER NOT NULL DEFAULT 3,
            "popular" BOOLEAN NOT NULL DEFAULT false,
            "views" INTEGER NOT NULL DEFAULT 0,
            "isPublished" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- SupportTicket
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SupportTicket') THEN
        CREATE TABLE "SupportTicket" (
            "id" TEXT NOT NULL,
            "subject" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "priority" TEXT NOT NULL DEFAULT 'medium',
            "status" TEXT NOT NULL DEFAULT 'open',
            "userId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- Each column is added only if it does not already exist.
-- ============================================================================

-- User columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'id') THEN
        ALTER TABLE "User" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'email') THEN
        ALTER TABLE "User" ADD COLUMN "email" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'emailVerified') THEN
        ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordHash') THEN
        ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'handle') THEN
        ALTER TABLE "User" ADD COLUMN "handle" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'name') THEN
        ALTER TABLE "User" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'avatar') THEN
        ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'bio') THEN
        ALTER TABLE "User" ADD COLUMN "bio" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'website') THEN
        ALTER TABLE "User" ADD COLUMN "website" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'location') THEN
        ALTER TABLE "User" ADD COLUMN "location" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'publication') THEN
        ALTER TABLE "User" ADD COLUMN "publication" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role') THEN
        ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'isActive') THEN
        ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'createdAt') THEN
        ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'updatedAt') THEN
        ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'deletedAt') THEN
        ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
END $$;

-- UserSettings columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'id') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'userId') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'emailNotifications') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'pushNotifications') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "pushNotifications" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'emailMarketing') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "emailMarketing" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'allowComments') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "allowComments" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'allowLikes') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "allowLikes" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'showOnlineStatus') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'createdAt') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'UserSettings' AND column_name = 'updatedAt') THEN
        ALTER TABLE "UserSettings" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- Article columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'id') THEN
        ALTER TABLE "Article" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'slug') THEN
        ALTER TABLE "Article" ADD COLUMN "slug" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'title') THEN
        ALTER TABLE "Article" ADD COLUMN "title" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'excerpt') THEN
        ALTER TABLE "Article" ADD COLUMN "excerpt" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'body') THEN
        ALTER TABLE "Article" ADD COLUMN "body" TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'cover') THEN
        ALTER TABLE "Article" ADD COLUMN "cover" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'readMinutes') THEN
        ALTER TABLE "Article" ADD COLUMN "readMinutes" INTEGER NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'categoryId') THEN
        ALTER TABLE "Article" ADD COLUMN "categoryId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'authorId') THEN
        ALTER TABLE "Article" ADD COLUMN "authorId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'likesCount') THEN
        ALTER TABLE "Article" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'views') THEN
        ALTER TABLE "Article" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'featured') THEN
        ALTER TABLE "Article" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'isPublished') THEN
        ALTER TABLE "Article" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'publishedAt') THEN
        ALTER TABLE "Article" ADD COLUMN "publishedAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'createdAt') THEN
        ALTER TABLE "Article" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Article" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'deletedAt') THEN
        ALTER TABLE "Article" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Article' AND column_name = 'commentsCount') THEN
        ALTER TABLE "Article" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Highlight columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'id') THEN
        ALTER TABLE "Highlight" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'title') THEN
        ALTER TABLE "Highlight" ADD COLUMN "title" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'cover') THEN
        ALTER TABLE "Highlight" ADD COLUMN "cover" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'videoUrl') THEN
        ALTER TABLE "Highlight" ADD COLUMN "videoUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'thumbnailUrl') THEN
        ALTER TABLE "Highlight" ADD COLUMN "thumbnailUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'handle') THEN
        ALTER TABLE "Highlight" ADD COLUMN "handle" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'authorId') THEN
        ALTER TABLE "Highlight" ADD COLUMN "authorId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'likesCount') THEN
        ALTER TABLE "Highlight" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'commentsCount') THEN
        ALTER TABLE "Highlight" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'shares') THEN
        ALTER TABLE "Highlight" ADD COLUMN "shares" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'description') THEN
        ALTER TABLE "Highlight" ADD COLUMN "description" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'music') THEN
        ALTER TABLE "Highlight" ADD COLUMN "music" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'aspectRatio') THEN
        ALTER TABLE "Highlight" ADD COLUMN "aspectRatio" DOUBLE PRECISION DEFAULT 1.777;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'duration') THEN
        ALTER TABLE "Highlight" ADD COLUMN "duration" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'isPublished') THEN
        ALTER TABLE "Highlight" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'publishedAt') THEN
        ALTER TABLE "Highlight" ADD COLUMN "publishedAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'createdAt') THEN
        ALTER TABLE "Highlight" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Highlight" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Highlight' AND column_name = 'deletedAt') THEN
        ALTER TABLE "Highlight" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Story columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'id') THEN
        ALTER TABLE "Story" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'authorId') THEN
        ALTER TABLE "Story" ADD COLUMN "authorId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'image') THEN
        ALTER TABLE "Story" ADD COLUMN "image" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'caption') THEN
        ALTER TABLE "Story" ADD COLUMN "caption" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'duration') THEN
        ALTER TABLE "Story" ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 5000;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'createdAt') THEN
        ALTER TABLE "Story" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Story' AND column_name = 'expiresAt') THEN
        ALTER TABLE "Story" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '24:00:00'::interval);
    END IF;
END $$;

-- StoryView columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StoryView' AND column_name = 'id') THEN
        ALTER TABLE "StoryView" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StoryView' AND column_name = 'storyId') THEN
        ALTER TABLE "StoryView" ADD COLUMN "storyId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StoryView' AND column_name = 'viewerId') THEN
        ALTER TABLE "StoryView" ADD COLUMN "viewerId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'StoryView' AND column_name = 'viewedAt') THEN
        ALTER TABLE "StoryView" ADD COLUMN "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Comment columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'id') THEN
        ALTER TABLE "Comment" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'articleSlug') THEN
        ALTER TABLE "Comment" ADD COLUMN "articleSlug" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'highlightId') THEN
        ALTER TABLE "Comment" ADD COLUMN "highlightId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'authorId') THEN
        ALTER TABLE "Comment" ADD COLUMN "authorId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'body') THEN
        ALTER TABLE "Comment" ADD COLUMN "body" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'parentId') THEN
        ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'likesCount') THEN
        ALTER TABLE "Comment" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'createdAt') THEN
        ALTER TABLE "Comment" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Comment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Comment' AND column_name = 'deletedAt') THEN
        ALTER TABLE "Comment" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Category columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'id') THEN
        ALTER TABLE "Category" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'name') THEN
        ALTER TABLE "Category" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'tint') THEN
        ALTER TABLE "Category" ADD COLUMN "tint" TEXT NOT NULL DEFAULT '#e5e5e5';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Category' AND column_name = 'slug') THEN
        ALTER TABLE "Category" ADD COLUMN "slug" TEXT NOT NULL;
    END IF;
END $$;

-- Like columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'id') THEN
        ALTER TABLE "Like" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'userId') THEN
        ALTER TABLE "Like" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'articleSlug') THEN
        ALTER TABLE "Like" ADD COLUMN "articleSlug" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'highlightId') THEN
        ALTER TABLE "Like" ADD COLUMN "highlightId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'commentId') THEN
        ALTER TABLE "Like" ADD COLUMN "commentId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Like' AND column_name = 'createdAt') THEN
        ALTER TABLE "Like" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Bookmark columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Bookmark' AND column_name = 'id') THEN
        ALTER TABLE "Bookmark" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Bookmark' AND column_name = 'userId') THEN
        ALTER TABLE "Bookmark" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Bookmark' AND column_name = 'articleSlug') THEN
        ALTER TABLE "Bookmark" ADD COLUMN "articleSlug" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Bookmark' AND column_name = 'highlightId') THEN
        ALTER TABLE "Bookmark" ADD COLUMN "highlightId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Bookmark' AND column_name = 'createdAt') THEN
        ALTER TABLE "Bookmark" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Follow columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Follow' AND column_name = 'id') THEN
        ALTER TABLE "Follow" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Follow' AND column_name = 'followerId') THEN
        ALTER TABLE "Follow" ADD COLUMN "followerId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Follow' AND column_name = 'followingId') THEN
        ALTER TABLE "Follow" ADD COLUMN "followingId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Follow' AND column_name = 'createdAt') THEN
        ALTER TABLE "Follow" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Notification columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'id') THEN
        ALTER TABLE "Notification" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'userId') THEN
        ALTER TABLE "Notification" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'actorId') THEN
        ALTER TABLE "Notification" ADD COLUMN "actorId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'kind') THEN
        ALTER TABLE "Notification" ADD COLUMN "kind" "NotificationKind" NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'articleSlug') THEN
        ALTER TABLE "Notification" ADD COLUMN "articleSlug" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'highlightId') THEN
        ALTER TABLE "Notification" ADD COLUMN "highlightId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'commentId') THEN
        ALTER TABLE "Notification" ADD COLUMN "commentId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'body') THEN
        ALTER TABLE "Notification" ADD COLUMN "body" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'metadata') THEN
        ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'read') THEN
        ALTER TABLE "Notification" ADD COLUMN "read" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'readAt') THEN
        ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'scheduledFor') THEN
        ALTER TABLE "Notification" ADD COLUMN "scheduledFor" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'createdAt') THEN
        ALTER TABLE "Notification" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Notification" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- RefreshToken columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'id') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'userId') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'token') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "token" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'expiresAt') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'deviceInfo') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "deviceInfo" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'RefreshToken' AND column_name = 'createdAt') THEN
        ALTER TABLE "RefreshToken" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Session columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'id') THEN
        ALTER TABLE "Session" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'userId') THEN
        ALTER TABLE "Session" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'sessionToken') THEN
        ALTER TABLE "Session" ADD COLUMN "sessionToken" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'expiresAt') THEN
        ALTER TABLE "Session" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'deviceInfo') THEN
        ALTER TABLE "Session" ADD COLUMN "deviceInfo" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'ipAddress') THEN
        ALTER TABLE "Session" ADD COLUMN "ipAddress" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'userAgent') THEN
        ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'createdAt') THEN
        ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Media columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'id') THEN
        ALTER TABLE "Media" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'filename') THEN
        ALTER TABLE "Media" ADD COLUMN "filename" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'originalName') THEN
        ALTER TABLE "Media" ADD COLUMN "originalName" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'mimeType') THEN
        ALTER TABLE "Media" ADD COLUMN "mimeType" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'size') THEN
        ALTER TABLE "Media" ADD COLUMN "size" INTEGER NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'type') THEN
        ALTER TABLE "Media" ADD COLUMN "type" "MediaType" NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'url') THEN
        ALTER TABLE "Media" ADD COLUMN "url" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'thumbnailUrl') THEN
        ALTER TABLE "Media" ADD COLUMN "thumbnailUrl" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'width') THEN
        ALTER TABLE "Media" ADD COLUMN "width" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'height') THEN
        ALTER TABLE "Media" ADD COLUMN "height" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'metadata') THEN
        ALTER TABLE "Media" ADD COLUMN "metadata" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'uploadedBy') THEN
        ALTER TABLE "Media" ADD COLUMN "uploadedBy" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'createdAt') THEN
        ALTER TABLE "Media" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Media' AND column_name = 'deletedAt') THEN
        ALTER TABLE "Media" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Webhook columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'id') THEN
        ALTER TABLE "Webhook" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'name') THEN
        ALTER TABLE "Webhook" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'url') THEN
        ALTER TABLE "Webhook" ADD COLUMN "url" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'secret') THEN
        ALTER TABLE "Webhook" ADD COLUMN "secret" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'events') THEN
        ALTER TABLE "Webhook" ADD COLUMN "events" TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'isActive') THEN
        ALTER TABLE "Webhook" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'createdAt') THEN
        ALTER TABLE "Webhook" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Webhook' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Webhook" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- WebhookLog columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'id') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'webhookId') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "webhookId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'event') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "event" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'payload') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "payload" JSONB NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'statusCode') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "statusCode" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'response') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "response" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'error') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "error" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'WebhookLog' AND column_name = 'createdAt') THEN
        ALTER TABLE "WebhookLog" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AuditLog columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'id') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'userId') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "userId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'action') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "action" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'resource') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "resource" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'resourceId') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "resourceId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'details') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "details" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'metadata') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'changes') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "changes" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'success') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'ipAddress') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'userAgent') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'location') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "location" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'createdAt') THEN
        ALTER TABLE "AuditLog" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- ApiKey columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'id') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'name') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'key') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "key" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'userId') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "userId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'scopes') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "scopes" TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'isActive') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'expiresAt') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'createdAt') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ApiKey' AND column_name = 'lastUsedAt') THEN
        ALTER TABLE "ApiKey" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Report columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'id') THEN
        ALTER TABLE "Report" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'targetType') THEN
        ALTER TABLE "Report" ADD COLUMN "targetType" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'targetId') THEN
        ALTER TABLE "Report" ADD COLUMN "targetId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'reason') THEN
        ALTER TABLE "Report" ADD COLUMN "reason" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'reporterId') THEN
        ALTER TABLE "Report" ADD COLUMN "reporterId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'status') THEN
        ALTER TABLE "Report" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'priority') THEN
        ALTER TABLE "Report" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'aiScore') THEN
        ALTER TABLE "Report" ADD COLUMN "aiScore" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'aiCategory') THEN
        ALTER TABLE "Report" ADD COLUMN "aiCategory" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'notes') THEN
        ALTER TABLE "Report" ADD COLUMN "notes" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'resolvedById') THEN
        ALTER TABLE "Report" ADD COLUMN "resolvedById" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'resolvedAt') THEN
        ALTER TABLE "Report" ADD COLUMN "resolvedAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'createdAt') THEN
        ALTER TABLE "Report" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Report' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Report" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- Tag columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tag' AND column_name = 'id') THEN
        ALTER TABLE "Tag" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tag' AND column_name = 'name') THEN
        ALTER TABLE "Tag" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tag' AND column_name = 'slug') THEN
        ALTER TABLE "Tag" ADD COLUMN "slug" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tag' AND column_name = 'createdAt') THEN
        ALTER TABLE "Tag" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- FeatureFlag columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'id') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'key') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "key" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'description') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "description" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'enabled') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'rollout') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "rollout" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'createdAt') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'FeatureFlag' AND column_name = 'updatedAt') THEN
        ALTER TABLE "FeatureFlag" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- SystemSetting columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'id') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'key') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "key" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'value') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "value" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'category') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'updatedAt') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SystemSetting' AND column_name = 'createdAt') THEN
        ALTER TABLE "SystemSetting" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Advertisement columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'id') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'name') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'status') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'impressions') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "impressions" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'clicks') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'spend') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "spend" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'startsAt') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "startsAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'endsAt') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "endsAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'createdAt') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Advertisement' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Advertisement" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- AIAgent columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'id') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'name') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'description') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "description" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'model') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "model" TEXT NOT NULL DEFAULT 'gpt-4';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'status') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'idle';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'runs') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "runs" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'lastRunAt') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "lastRunAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'config') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "config" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'createdAt') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'AIAgent' AND column_name = 'updatedAt') THEN
        ALTER TABLE "AIAgent" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- BackgroundJob columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'id') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'name') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "name" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'queue') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "queue" TEXT NOT NULL DEFAULT 'default';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'status') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'duration') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "duration" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'error') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "error" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'payload') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "payload" JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'ranAt') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BackgroundJob' AND column_name = 'createdAt') THEN
        ALTER TABLE "BackgroundJob" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- HelpArticle columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'id') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'slug') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "slug" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'title') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "title" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'description') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "description" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'content') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "content" TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'category') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "category" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'icon') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "icon" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'readMinutes') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "readMinutes" INTEGER NOT NULL DEFAULT 3;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'popular') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "popular" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'views') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'isPublished') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'createdAt') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'HelpArticle' AND column_name = 'updatedAt') THEN
        ALTER TABLE "HelpArticle" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- SupportTicket columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'id') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "id" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'subject') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "subject" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'message') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "message" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'priority') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'status') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'userId') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "userId" TEXT NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'createdAt') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SupportTicket' AND column_name = 'updatedAt') THEN
        ALTER TABLE "SupportTicket" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
    END IF;
END $$;

-- ============================================================================
-- PRIMARY KEY CONSTRAINTS (ensure pkey exists on each table)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_pkey' AND contype = 'p') THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSettings_pkey' AND contype = 'p') THEN
        ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Article_pkey' AND contype = 'p') THEN
        ALTER TABLE "Article" ADD CONSTRAINT "Article_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Highlight_pkey' AND contype = 'p') THEN
        ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Story_pkey' AND contype = 'p') THEN
        ALTER TABLE "Story" ADD CONSTRAINT "Story_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoryView_pkey' AND contype = 'p') THEN
        ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_pkey' AND contype = 'p') THEN
        ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_pkey' AND contype = 'p') THEN
        ALTER TABLE "Category" ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_pkey' AND contype = 'p') THEN
        ALTER TABLE "Like" ADD CONSTRAINT "Like_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_pkey' AND contype = 'p') THEN
        ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_pkey' AND contype = 'p') THEN
        ALTER TABLE "Follow" ADD CONSTRAINT "Follow_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_pkey' AND contype = 'p') THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_pkey' AND contype = 'p') THEN
        ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_pkey' AND contype = 'p') THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_pkey' AND contype = 'p') THEN
        ALTER TABLE "Media" ADD CONSTRAINT "Media_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Webhook_pkey' AND contype = 'p') THEN
        ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookLog_pkey' AND contype = 'p') THEN
        ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_pkey' AND contype = 'p') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_pkey' AND contype = 'p') THEN
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_pkey' AND contype = 'p') THEN
        ALTER TABLE "Report" ADD CONSTRAINT "Report_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_pkey' AND contype = 'p') THEN
        ALTER TABLE "Tag" ADD CONSTRAINT "Tag_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeatureFlag_pkey' AND contype = 'p') THEN
        ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemSetting_pkey' AND contype = 'p') THEN
        ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Advertisement_pkey' AND contype = 'p') THEN
        ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIAgent_pkey' AND contype = 'p') THEN
        ALTER TABLE "AIAgent" ADD CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BackgroundJob_pkey' AND contype = 'p') THEN
        ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HelpArticle_pkey' AND contype = 'p') THEN
        ALTER TABLE "HelpArticle" ADD CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_pkey' AND contype = 'p') THEN
        ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

-- ============================================================================
-- INDEXES (including unique indexes) IF NOT EXISTS
-- ============================================================================

-- User indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_email_key') THEN
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_handle_key') THEN
        CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_handle_idx') THEN
        CREATE INDEX "User_handle_idx" ON "User"("handle");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_email_idx') THEN
        CREATE INDEX "User_email_idx" ON "User"("email");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'User' AND indexname = 'User_role_idx') THEN
        CREATE INDEX "User_role_idx" ON "User"("role");
    END IF;
END $$;

-- UserSettings indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'UserSettings' AND indexname = 'UserSettings_userId_key') THEN
        CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
    END IF;
END $$;

-- Article indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_slug_key') THEN
        CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_slug_idx') THEN
        CREATE INDEX "Article_slug_idx" ON "Article"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_authorId_idx') THEN
        CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_categoryId_idx') THEN
        CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_featured_idx') THEN
        CREATE INDEX "Article_featured_idx" ON "Article"("featured");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Article' AND indexname = 'Article_isPublished_idx') THEN
        CREATE INDEX "Article_isPublished_idx" ON "Article"("isPublished");
    END IF;
END $$;

-- Highlight indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Highlight' AND indexname = 'Highlight_handle_idx') THEN
        CREATE INDEX "Highlight_handle_idx" ON "Highlight"("handle");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Highlight' AND indexname = 'Highlight_authorId_idx') THEN
        CREATE INDEX "Highlight_authorId_idx" ON "Highlight"("authorId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Highlight' AND indexname = 'Highlight_isPublished_idx') THEN
        CREATE INDEX "Highlight_isPublished_idx" ON "Highlight"("isPublished");
    END IF;
END $$;

-- Story indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Story' AND indexname = 'Story_authorId_idx') THEN
        CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Story' AND indexname = 'Story_expiresAt_idx') THEN
        CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");
    END IF;
END $$;

-- StoryView indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'StoryView' AND indexname = 'StoryView_storyId_viewerId_key') THEN
        CREATE UNIQUE INDEX "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");
    END IF;
END $$;

-- Comment indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Comment' AND indexname = 'Comment_articleSlug_idx') THEN
        CREATE INDEX "Comment_articleSlug_idx" ON "Comment"("articleSlug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Comment' AND indexname = 'Comment_highlightId_idx') THEN
        CREATE INDEX "Comment_highlightId_idx" ON "Comment"("highlightId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Comment' AND indexname = 'Comment_authorId_idx') THEN
        CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Comment' AND indexname = 'Comment_parentId_idx') THEN
        CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
    END IF;
END $$;

-- Category indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Category' AND indexname = 'Category_name_key') THEN
        CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Category' AND indexname = 'Category_slug_key') THEN
        CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Category' AND indexname = 'Category_slug_idx') THEN
        CREATE INDEX "Category_slug_idx" ON "Category"("slug");
    END IF;
END $$;

-- Like indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Like' AND indexname = 'Like_userId_idx') THEN
        CREATE INDEX "Like_userId_idx" ON "Like"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Like' AND indexname = 'Like_userId_articleSlug_key') THEN
        CREATE UNIQUE INDEX "Like_userId_articleSlug_key" ON "Like"("userId", "articleSlug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Like' AND indexname = 'Like_userId_highlightId_key') THEN
        CREATE UNIQUE INDEX "Like_userId_highlightId_key" ON "Like"("userId", "highlightId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Like' AND indexname = 'Like_userId_commentId_key') THEN
        CREATE UNIQUE INDEX "Like_userId_commentId_key" ON "Like"("userId", "commentId");
    END IF;
END $$;

-- Bookmark indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Bookmark' AND indexname = 'Bookmark_userId_idx') THEN
        CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Bookmark' AND indexname = 'Bookmark_userId_articleSlug_key') THEN
        CREATE UNIQUE INDEX "Bookmark_userId_articleSlug_key" ON "Bookmark"("userId", "articleSlug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Bookmark' AND indexname = 'Bookmark_userId_highlightId_key') THEN
        CREATE UNIQUE INDEX "Bookmark_userId_highlightId_key" ON "Bookmark"("userId", "highlightId");
    END IF;
END $$;

-- Follow indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Follow' AND indexname = 'Follow_followerId_idx') THEN
        CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Follow' AND indexname = 'Follow_followingId_idx') THEN
        CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Follow' AND indexname = 'Follow_followerId_followingId_key') THEN
        CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
    END IF;
END $$;

-- Notification indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Notification' AND indexname = 'Notification_userId_idx') THEN
        CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Notification' AND indexname = 'Notification_userId_read_idx') THEN
        CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Notification' AND indexname = 'Notification_createdAt_idx') THEN
        CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
    END IF;
END $$;

-- RefreshToken indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'RefreshToken' AND indexname = 'RefreshToken_token_key') THEN
        CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'RefreshToken' AND indexname = 'RefreshToken_userId_idx') THEN
        CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'RefreshToken' AND indexname = 'RefreshToken_expiresAt_idx') THEN
        CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
    END IF;
END $$;

-- Session indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Session' AND indexname = 'Session_sessionToken_key') THEN
        CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Session' AND indexname = 'Session_userId_idx') THEN
        CREATE INDEX "Session_userId_idx" ON "Session"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Session' AND indexname = 'Session_expiresAt_idx') THEN
        CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
    END IF;
END $$;

-- Media indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Media' AND indexname = 'Media_uploadedBy_idx') THEN
        CREATE INDEX "Media_uploadedBy_idx" ON "Media"("uploadedBy");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Media' AND indexname = 'Media_type_idx') THEN
        CREATE INDEX "Media_type_idx" ON "Media"("type");
    END IF;
END $$;

-- AuditLog indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'AuditLog' AND indexname = 'AuditLog_userId_idx') THEN
        CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'AuditLog' AND indexname = 'AuditLog_action_idx') THEN
        CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'AuditLog' AND indexname = 'AuditLog_createdAt_idx') THEN
        CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'AuditLog' AND indexname = 'AuditLog_success_idx') THEN
        CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");
    END IF;
END $$;

-- ApiKey indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ApiKey' AND indexname = 'ApiKey_key_key') THEN
        CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ApiKey' AND indexname = 'ApiKey_userId_idx') THEN
        CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ApiKey' AND indexname = 'ApiKey_key_idx') THEN
        CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");
    END IF;
END $$;

-- Report indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Report' AND indexname = 'Report_targetType_targetId_idx') THEN
        CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Report' AND indexname = 'Report_status_idx') THEN
        CREATE INDEX "Report_status_idx" ON "Report"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Report' AND indexname = 'Report_reporterId_idx') THEN
        CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Report' AND indexname = 'Report_createdAt_idx') THEN
        CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
    END IF;
END $$;

-- Tag indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Tag' AND indexname = 'Tag_name_key') THEN
        CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Tag' AND indexname = 'Tag_slug_key') THEN
        CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Tag' AND indexname = 'Tag_slug_idx') THEN
        CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");
    END IF;
END $$;

-- FeatureFlag indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'FeatureFlag' AND indexname = 'FeatureFlag_key_key') THEN
        CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'FeatureFlag' AND indexname = 'FeatureFlag_key_idx') THEN
        CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");
    END IF;
END $$;

-- SystemSetting indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SystemSetting' AND indexname = 'SystemSetting_key_key') THEN
        CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SystemSetting' AND indexname = 'SystemSetting_key_idx') THEN
        CREATE INDEX "SystemSetting_key_idx" ON "SystemSetting"("key");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SystemSetting' AND indexname = 'SystemSetting_category_idx') THEN
        CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");
    END IF;
END $$;

-- Advertisement indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Advertisement' AND indexname = 'Advertisement_status_idx') THEN
        CREATE INDEX "Advertisement_status_idx" ON "Advertisement"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'Advertisement' AND indexname = 'Advertisement_createdAt_idx') THEN
        CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");
    END IF;
END $$;

-- AIAgent indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'AIAgent' AND indexname = 'AIAgent_status_idx') THEN
        CREATE INDEX "AIAgent_status_idx" ON "AIAgent"("status");
    END IF;
END $$;

-- BackgroundJob indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'BackgroundJob' AND indexname = 'BackgroundJob_status_idx') THEN
        CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'BackgroundJob' AND indexname = 'BackgroundJob_queue_idx') THEN
        CREATE INDEX "BackgroundJob_queue_idx" ON "BackgroundJob"("queue");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'BackgroundJob' AND indexname = 'BackgroundJob_ranAt_idx') THEN
        CREATE INDEX "BackgroundJob_ranAt_idx" ON "BackgroundJob"("ranAt");
    END IF;
END $$;

-- HelpArticle indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'HelpArticle' AND indexname = 'HelpArticle_slug_key') THEN
        CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'HelpArticle' AND indexname = 'HelpArticle_slug_idx') THEN
        CREATE INDEX "HelpArticle_slug_idx" ON "HelpArticle"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'HelpArticle' AND indexname = 'HelpArticle_category_idx') THEN
        CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'HelpArticle' AND indexname = 'HelpArticle_isPublished_idx') THEN
        CREATE INDEX "HelpArticle_isPublished_idx" ON "HelpArticle"("isPublished");
    END IF;
END $$;

-- SupportTicket indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_userId_idx') THEN
        CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_status_idx') THEN
        CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'SupportTicket' AND indexname = 'SupportTicket_priority_idx') THEN
        CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");
    END IF;
END $$;

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSettings_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Article_authorId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Article_categoryId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Highlight_authorId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Story_authorId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoryView_storyId_fkey' AND contype = 'f') THEN
        ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoryView_viewerId_fkey' AND contype = 'f') THEN
        ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_authorId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_highlightId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Comment" ADD CONSTRAINT "Comment_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_parentId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followingId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefreshToken_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_uploadedBy_fkey' AND contype = 'f') THEN
        ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookLog_webhookId_fkey' AND contype = 'f') THEN
        ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Report_reporterId_fkey' AND contype = 'f') THEN
        ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- End of comprehensive sync migration
-- ============================================================================
