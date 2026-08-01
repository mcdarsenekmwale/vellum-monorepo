-- ============================================================================
-- Fix password-reset corruption & broken email verification
-- Prior code wrote reset:xxx / verify:yyy markers DIRECTLY INTO passwordHash,
-- permanently corrupting bcrypt hashes when user never clicked the link.
-- Add dedicated nullable columns instead.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'resetToken') THEN
        ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_resetToken_key') THEN
        CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'resetTokenExpiresAt') THEN
        ALTER TABLE "User" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'verificationToken') THEN
        ALTER TABLE "User" ADD COLUMN "verificationToken" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'User_verificationToken_key') THEN
        CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'verificationTokenExpiresAt') THEN
        ALTER TABLE "User" ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);
    END IF;
END $$;
