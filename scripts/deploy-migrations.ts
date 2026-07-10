import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('Connected to database');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Role" (
        "value" TEXT NOT NULL PRIMARY KEY
      );
    `;
    
    await prisma.$executeRaw`
      INSERT INTO "Role" ("value") VALUES 
        ('ADMIN'), ('MODERATOR'), ('CREATOR'), ('USER'), ('GUEST')
      ON CONFLICT DO NOTHING;
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "NotificationKind" (
        "value" TEXT NOT NULL PRIMARY KEY
      );
    `;

    await prisma.$executeRaw`
      INSERT INTO "NotificationKind" ("value") VALUES 
        ('LIKE'), ('COMMENT'), ('REPLY'), ('FOLLOW'), ('BOOKMARK'), ('MENTION'), ('SYSTEM')
      ON CONFLICT DO NOTHING;
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "MediaType" (
        "value" TEXT NOT NULL PRIMARY KEY
      );
    `;

    await prisma.$executeRaw`
      INSERT INTO "MediaType" ("value") VALUES 
        ('IMAGE'), ('VIDEO'), ('DOCUMENT')
      ON CONFLICT DO NOTHING;
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "emailVerified" TIMESTAMP,
        "passwordHash" TEXT NOT NULL,
        "handle" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "avatar" TEXT,
        "bio" TEXT,
        "publication" TEXT,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "User"("handle");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_handle_idx" ON "User"("handle");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL UNIQUE,
        "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
        "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
        "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
        "allowComments" BOOLEAN NOT NULL DEFAULT true,
        "allowLikes" BOOLEAN NOT NULL DEFAULT true,
        "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Category" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "tint" TEXT NOT NULL DEFAULT '#e5e5e5',
        "slug" TEXT NOT NULL UNIQUE
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Category_slug_idx" ON "Category"("slug");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Article" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "slug" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL,
        "excerpt" TEXT NOT NULL,
        "body" TEXT[] NOT NULL,
        "cover" TEXT,
        "readMinutes" INTEGER NOT NULL,
        "categoryId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "likesCount" INTEGER NOT NULL DEFAULT 0,
        "views" INTEGER NOT NULL DEFAULT 0,
        "featured" BOOLEAN NOT NULL DEFAULT false,
        "isPublished" BOOLEAN NOT NULL DEFAULT false,
        "publishedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Article_slug_idx" ON "Article"("slug");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Article_authorId_idx" ON "Article"("authorId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Article_categoryId_idx" ON "Article"("categoryId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Article_featured_idx" ON "Article"("featured");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Article_isPublished_idx" ON "Article"("isPublished");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Highlight" (
        "id" TEXT NOT NULL PRIMARY KEY,
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
        "publishedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Highlight_handle_idx" ON "Highlight"("handle");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Highlight_authorId_idx" ON "Highlight"("authorId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Highlight_isPublished_idx" ON "Highlight"("isPublished");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Comment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "articleSlug" TEXT,
        "highlightId" TEXT,
        "authorId" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "parentId" TEXT,
        "likesCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_articleSlug_idx" ON "Comment"("articleSlug");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_highlightId_idx" ON "Comment"("highlightId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Like" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "articleSlug" TEXT,
        "highlightId" TEXT,
        "commentId" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_articleSlug_key" ON "Like"("userId", "articleSlug");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_highlightId_key" ON "Like"("userId", "highlightId");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Like_userId_commentId_key" ON "Like"("userId", "commentId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Like_userId_idx" ON "Like"("userId");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Bookmark" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "articleSlug" TEXT,
        "highlightId" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_articleSlug_key" ON "Bookmark"("userId", "articleSlug");`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_highlightId_key" ON "Bookmark"("userId", "highlightId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Bookmark_userId_idx" ON "Bookmark"("userId");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Follow" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "followerId" TEXT NOT NULL,
        "followingId" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "Follow"("followerId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "actorId" TEXT,
        "kind" TEXT NOT NULL,
        "articleSlug" TEXT,
        "highlightId" TEXT,
        "commentId" TEXT,
        "body" TEXT,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "RefreshToken" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "deviceInfo" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "deviceInfo" TEXT,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Media" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "filename" TEXT NOT NULL,
        "originalName" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL,
        "size" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "thumbnailUrl" TEXT,
        "width" INTEGER,
        "height" INTEGER,
        "metadata" JSON,
        "uploadedBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Media_uploadedBy_idx" ON "Media"("uploadedBy");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Media_type_idx" ON "Media"("type");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Story" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "authorId" TEXT NOT NULL,
        "image" TEXT NOT NULL,
        "caption" TEXT,
        "duration" INTEGER NOT NULL DEFAULT 5000,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Story_authorId_idx" ON "Story"("authorId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story"("expiresAt");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "StoryView" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "storyId" TEXT NOT NULL,
        "viewerId" TEXT NOT NULL,
        "viewedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Webhook" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "secret" TEXT NOT NULL,
        "events" TEXT[] NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "WebhookLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "webhookId" TEXT NOT NULL,
        "event" TEXT NOT NULL,
        "payload" JSON NOT NULL,
        "statusCode" INTEGER,
        "response" TEXT,
        "error" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT,
        "action" TEXT NOT NULL,
        "resource" TEXT NOT NULL,
        "resourceId" TEXT,
        "details" JSON,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ApiKey" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "key" TEXT NOT NULL UNIQUE,
        "userId" TEXT,
        "scopes" TEXT[] NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastUsedAt" TIMESTAMP
      );
    `;

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "ApiKey_key_idx" ON "ApiKey"("key");`;

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMP,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP,
        "started_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `;

    console.log('Database schema created successfully');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error creating database schema:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();