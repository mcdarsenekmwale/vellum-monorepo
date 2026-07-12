import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "@vellum/api",
    framework: "nestjs",
    httpPort: 3000,
  },
});
