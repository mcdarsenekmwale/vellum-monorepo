#!/usr/bin/env node
/**
 * Applies the comprehensive sync migration to the production database.
 *
 * Usage:
 *   node scripts/apply-sync-migration.mjs
 *
 * Environment variables:
 *   DATABASE_URL  - Pooled connection URL (for verification queries)
 *   DIRECT_URL    - Direct connection URL (for DDL operations)
 *
 * If DIRECT_URL is not set, falls back to DATABASE_URL.
 */
import "dotenv/config";
import pg from "pg";

const { Client } = pg;

async function main() {
  // Use DIRECT_URL for DDL operations (migrations should use direct connection)
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("Error: DIRECT_URL or DATABASE_URL environment variable is required");
    process.exit(1);
  }

  // Mask password for logging
  const maskedUrl = connectionString.replace(/(:[^:@]+@)/, ":***@");
  console.log("========================================");
  console.log("  Apply Comprehensive Sync Migration");
  console.log("========================================");
  console.log(`  Connection: ${maskedUrl}`);
  console.log("");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("sslmode=") ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log("→ Connecting to database...");
    await client.connect();
    console.log("  Connected successfully.");
    console.log("");

    // Check current table count
    const { rows: tablesBefore } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`→ Tables before migration: ${tablesBefore.length}`);
    for (const t of tablesBefore) {
      console.log(`  - ${t.table_name}`);
    }
    console.log("");

    // Read and execute the migration SQL
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const migrationPath = path.resolve(__dirname, "..", "prisma", "migrations", "8_comprehensive_sync", "migration.sql");

    if (!fs.existsSync(migrationPath)) {
      console.error(`  Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    console.log(`→ Applying migration (${migrationSql.length} bytes)...`);

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query("COMMIT");
      console.log("  Migration applied successfully.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log("");

    // Check table count after migration
    const { rows: tablesAfter } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`→ Tables after migration: ${tablesAfter.length}`);
    for (const t of tablesAfter) {
      console.log(`  - ${t.table_name}`);
    }
    console.log("");

    // Check column count
    const { rows: colCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `);
    console.log(`→ Total columns: ${colCount[0].count}`);
    console.log("");

    // Check index count
    const { rows: idxCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    console.log(`→ Total indexes: ${idxCount[0].count}`);
    console.log("");

    // Mark migration as applied in _prisma_migrations table
    const migrationName = "8_comprehensive_sync";
    const { rows: existing } = await client.query(
      `SELECT id FROM _prisma_migrations WHERE migration_name = $1`,
      [migrationName]
    );

    if (existing.length === 0) {
      await client.query(`
        INSERT INTO _prisma_migrations (id, migration_name, migration_key, finished_at, applied_steps_count)
        VALUES (gen_random_uuid()::text, $1, $1, now(), 0)
      `, [migrationName]);
      console.log(`→ Migration '${migrationName}' marked as applied in _prisma_migrations.`);
    } else {
      console.log(`→ Migration '${migrationName}' already recorded in _prisma_migrations.`);
    }
    console.log("");

    // Verify a simple query works
    try {
      await client.query(`SELECT 1 as test`);
      console.log("→ Verification query: OK");
    } catch (error) {
      console.error(`→ Verification query failed: ${error.message}`);
    }

    console.log("");
    console.log("========================================");
    console.log("  Migration completed successfully!");
    console.log("========================================");

  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("  Migration failed");
    console.error("========================================");
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
