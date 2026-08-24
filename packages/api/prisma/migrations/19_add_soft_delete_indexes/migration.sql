-- Migration: Add indexes for soft-delete queries on User table
-- The deletedAt column already exists (added in 0_init or a sync migration);
-- this migration adds composite indexes to support efficient filtering of
-- active vs. soft-deleted users at scale.

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "User_isActive_deletedAt_idx" ON "User"("isActive", "deletedAt");
