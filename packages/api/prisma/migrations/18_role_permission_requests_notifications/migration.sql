-- ============================================================================
-- Role/Permission Request Center + NotificationKind enum expansion
-- Adds:
--   * 4 new NotificationKind values (ROLE_REQUEST_*)
--   * 2 new enum domains (RolePermissionRequestStatus, RolePermissionRequestType)
--   * "RolePermissionRequest" table: user-submitted permanent or temporary
--     role requests with justification, admin review, and lifecycle status
--   * "RolePermissionRequestEvent" table: immutable audit trail of every
--     state transition (PENDING→APPROVED/REJECTED, EXPIRED)
-- Everything wrapped in idempotent IF NOT EXISTS so the migration is safe
-- to re-run in any environment, including when values/tables were manually
-- pre-deployed (same pattern as migration 17).
-- ============================================================================

-- ─── Expand NotificationKind ──────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e
                    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'NotificationKind'
                     AND e.enumlabel = 'ROLE_REQUEST_SUBMITTED') THEN
        ALTER TYPE "NotificationKind" ADD VALUE 'ROLE_REQUEST_SUBMITTED';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e
                    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'NotificationKind'
                     AND e.enumlabel = 'ROLE_REQUEST_APPROVED') THEN
        ALTER TYPE "NotificationKind" ADD VALUE 'ROLE_REQUEST_APPROVED' AFTER 'ROLE_REQUEST_SUBMITTED';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e
                    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'NotificationKind'
                     AND e.enumlabel = 'ROLE_REQUEST_REJECTED') THEN
        ALTER TYPE "NotificationKind" ADD VALUE 'ROLE_REQUEST_REJECTED' AFTER 'ROLE_REQUEST_APPROVED';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_enum e
                    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'NotificationKind'
                     AND e.enumlabel = 'ROLE_REQUEST_EXPIRED') THEN
        ALTER TYPE "NotificationKind" ADD VALUE 'ROLE_REQUEST_EXPIRED' AFTER 'ROLE_REQUEST_REJECTED';
    END IF;
END $$;

-- ─── Create RolePermissionRequestStatus enum ──────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type t
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'RolePermissionRequestStatus') THEN
        CREATE TYPE "RolePermissionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
    END IF;
END $$;

-- ─── Create RolePermissionRequestType enum ────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type t
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = 'RolePermissionRequestType') THEN
        CREATE TYPE "RolePermissionRequestType" AS ENUM ('PERMANENT', 'TEMPORARY');
    END IF;
END $$;

-- ─── Create RolePermissionRequest table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RolePermissionRequest" (
    "id"                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "requesterId"         text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "reviewerId"          text NULL REFERENCES "User"("id") ON DELETE SET NULL,
    "requestedRoleKey"    text NOT NULL,
    "type"                "RolePermissionRequestType" NOT NULL,
    "status"              "RolePermissionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "justification"       text NOT NULL,
    "adminJustification"  text NULL,
    "startsAt"            timestamptz NULL,
    "expiresAt"           timestamptz NULL,
    "reviewedAt"          timestamptz NULL,
    "resultingAssignmentId" text NULL,
    "createdAt"           timestamptz NOT NULL DEFAULT now(),
    "updatedAt"           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "RolePermissionRequest_requesterId_idx" ON "RolePermissionRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "RolePermissionRequest_reviewerId_idx"  ON "RolePermissionRequest"("reviewerId");
CREATE INDEX IF NOT EXISTS "RolePermissionRequest_status_idx"      ON "RolePermissionRequest"("status");
CREATE INDEX IF NOT EXISTS "RolePermissionRequest_type_idx"        ON "RolePermissionRequest"("type");
CREATE INDEX IF NOT EXISTS "RolePermissionRequest_createdAt_idx"   ON "RolePermissionRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "RolePermissionRequest_expiresAt_idx"   ON "RolePermissionRequest"("expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        WHERE c.conname = 'RolePermissionRequest_requester_rolekey_status_unique'
    ) THEN
        ALTER TABLE "RolePermissionRequest"
            ADD CONSTRAINT "RolePermissionRequest_requester_rolekey_status_unique"
            UNIQUE ("requesterId", "requestedRoleKey", "status");
    END IF;
END $$;

-- ─── Create RolePermissionRequestEvent table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "RolePermissionRequestEvent" (
    "id"         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "requestId"  text NOT NULL REFERENCES "RolePermissionRequest"("id") ON DELETE CASCADE,
    "actorId"    text NULL REFERENCES "User"("id") ON DELETE SET NULL,
    "transition" "RolePermissionRequestStatus" NOT NULL,
    "reason"     text NULL,
    "metadata"   jsonb NULL,
    "createdAt"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "RolePermissionRequestEvent_requestId_idx" ON "RolePermissionRequestEvent"("requestId");
CREATE INDEX IF NOT EXISTS "RolePermissionRequestEvent_actorId_idx"   ON "RolePermissionRequestEvent"("actorId");
CREATE INDEX IF NOT EXISTS "RolePermissionRequestEvent_createdAt_idx" ON "RolePermissionRequestEvent"("createdAt");
