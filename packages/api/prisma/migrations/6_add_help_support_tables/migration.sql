-- ============================================================================
-- Idempotent: all CREATE TABLE / CREATE INDEX / ADD CONSTRAINT wrapped in
-- DO $$ ... IF NOT EXISTS ... $$ blocks.
-- ============================================================================

-- CreateTable: HelpArticle
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'HelpArticle') THEN
        CREATE TABLE "HelpArticle" (
            "id" TEXT NOT NULL,
            "slug" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "content" TEXT[] NOT NULL,
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

-- CreateTable: SupportTicket
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

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'HelpArticle_slug_key') THEN
        CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'HelpArticle_slug_idx') THEN
        CREATE INDEX "HelpArticle_slug_idx" ON "HelpArticle"("slug");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'HelpArticle_category_idx') THEN
        CREATE INDEX "HelpArticle_category_idx" ON "HelpArticle"("category");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'HelpArticle_isPublished_idx') THEN
        CREATE INDEX "HelpArticle_isPublished_idx" ON "HelpArticle"("isPublished");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SupportTicket_userId_idx') THEN
        CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SupportTicket_status_idx') THEN
        CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SupportTicket_priority_idx') THEN
        CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_userId_fkey' AND contype = 'f') THEN
        ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
