/**
 * Settings-only seed script
 *
 * Safely upserts all settings from SETTINGS_DEFINITIONS without touching users.
 * Run with: npx ts-node -r tsconfig-paths/register prisma/seed-settings.ts
 */

import { PrismaClient } from '@prisma/client';
import { SETTINGS_DEFINITIONS, SETTINGS_VERSION } from '../src/modules/admin/settings-definitions';

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${SETTINGS_DEFINITIONS.length} system settings...`);

  let created = 0;
  let updated = 0;

  for (const def of SETTINGS_DEFINITIONS) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: def.key } });

    if (existing) {
      // Update category and description only, preserve user's value
      await prisma.systemSetting.update({
        where: { key: def.key },
        data: {
          category: def.category,
          description: def.description,
          // Don't overwrite value - preserve user modifications
        },
      });
      updated++;
    } else {
      // Create new setting with default value
      await prisma.systemSetting.create({
        data: {
          key: def.key,
          value: def.value,
          category: def.category,
          description: def.description,
          version: SETTINGS_VERSION,
        },
      });
      created++;
    }
  }

  console.log(`Done! Created: ${created}, Updated: ${updated}, Total: ${SETTINGS_DEFINITIONS.length}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });