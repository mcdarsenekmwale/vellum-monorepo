import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  apps: {
    api: {
      name: "@vellum/api",
      root: "packages/api",
      framework: "nestjs",
      httpPort: 3000,
    },
  },
});
