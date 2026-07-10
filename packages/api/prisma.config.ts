import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  seed: {
    command: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  migrations: {
    path: 'prisma/migrations',
  },
  generator: {
    provider: 'prisma-client-js',
    binaryTargets: ['native', 'rhel-openssl-3.0.x'],
  },
})
