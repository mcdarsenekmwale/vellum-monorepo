-- ============================================================================
-- Expands the "Role" enum from 5 values to 8 values, matching the updated
-- schema.prisma definition (GUEST, USER, CREATOR, MODERATOR, SUPPORT_ADMIN, ADMIN,
-- PLATFORM_ADMIN, SUPER_ADMIN).
--
-- PostgreSQL enum values are positional, so we use BEFORE/AFTER to insert the new
-- values in the correct order for consistent ordering in introspection tools.
--
-- The whole migration is wrapped in DO blocks with pg_enum existence checks,
-- so running it against an environment that already has the values (e.g. prod
-- after a previous deploy) is a total no-op — never P2002 / duplicate value
-- errors.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_enum e
        JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'Role'
          AND e.enumlabel = 'SUPPORT_ADMIN'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'SUPPORT_ADMIN' AFTER 'MODERATOR';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_enum e
        JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'Role'
          AND e.enumlabel = 'PLATFORM_ADMIN'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'PLATFORM_ADMIN' AFTER 'ADMIN';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_enum e
        JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = 'Role'
          AND e.enumlabel = 'SUPER_ADMIN'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN' AFTER 'PLATFORM_ADMIN';
    END IF;
END $$;
