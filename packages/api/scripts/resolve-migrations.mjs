/**
 * Resolve failed/pending migration state on production database.
 *
 * The Prisma Compute GitHub branch deployment runs `prisma migrate deploy`,
 * which checks the `_prisma_migrations` tracking table. If a migration is
 * marked as "failed" (P3018), all subsequent migrations are blocked — even
 * if the SQL is now idempotent.
 *
 * Since the production database schema was already set up via CLI deployments
 * (NestjsBuild strategy does NOT run migrations — the app connects to the
 * existing DB), all schema objects already exist. This script marks every
 * migration as "applied" to clear the failed state and unblock future
 * `prisma migrate deploy` runs.
 *
 * Usage:
 *   cd packages/api
 *   node scripts/resolve-migrations.mjs
 *
 * Or with the npm script:
 *   npm run resolve:migrations
 */

import * as dotenv from "dotenv";
import { execSync } from "child_process";

// Load .env first (may contain PRISMA_API_TOKEN), then .env.production with override
dotenv.config();
dotenv.config({ path: ".env.production", override: true });

const migrations = [
  "0_init",
  "2_add_comments_count",
  "3_add_rls_policies",
  "5_add_admin_tables",
  "6_add_help_support_tables",
  "7_sync_production_schema",
  "8_comprehensive_sync",
];

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!databaseUrl) {
  console.error(
    "Error: DATABASE_URL (or DIRECT_URL) not found in .env.production"
  );
  process.exit(1);
}

console.log("========================================");
console.log("  Prisma Migrate Resolve — Production");
console.log("========================================");
console.log("");
console.log(`Database: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);
console.log("");

let success = 0;
let failed = 0;

for (const migration of migrations) {
  process.stdout.write(`  Resolving ${migration}... `);
  try {
    execSync(
      `npx prisma migrate resolve --applied ${migration}`,
      {
        stdio: "pipe",
        env: { ...process.env },
        cwd: process.cwd(),
      }
    );
    console.log("OK");
    success++;
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message;
    // "migration already marked as applied" is not a real error
    if (stderr.includes("already marked as applied") || stderr.includes("already exists")) {
      console.log("already applied (skipped)");
      success++;
    } else {
      console.log("FAILED");
      console.error(`    ${stderr.trim().split("\n")[0]}`);
      failed++;
    }
  }
}

console.log("");
console.log("========================================");
if (failed === 0) {
  console.log(`  ✅ All ${success} migrations resolved successfully!`);
  console.log("  Future `prisma migrate deploy` runs will skip these.");
} else {
  console.log(`  ⚠️  ${success} resolved, ${failed} failed`);
  console.log("  Check errors above and re-run after fixing.");
}
console.log("========================================");
console.log("");
