import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "@vellum/api",
    root: "packages/api",
    framework: "nestjs",
    httpPort: 3000,
  },
});
