import "dotenv/config";
import { ComputeClient, NestjsBuild } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, "..", "..", "..");

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  if (!apiToken) {
    console.error("Error: PRISMA_API_TOKEN environment variable is required");
    console.error("");
    console.error("Get a service token from: https://prisma.io/dashboard");
    console.error("Then run: PRISMA_API_TOKEN=<token> npm run deploy:api");
    process.exit(1);
  }

  const projectId = process.env.PRISMA_PROJECT_ID;
  if (!projectId) {
    console.error("Error: PRISMA_PROJECT_ID environment variable is required");
    console.error("");
    console.error("Find your project ID in the Prisma Data Platform dashboard.");
    process.exit(1);
  }

  const apiClient = createManagementApiClient({
    token: apiToken,
  });

  const compute = new ComputeClient(apiClient);

  console.log("========================================");
  console.log("  Prisma Compute — API Deploy");
  console.log("========================================");
  console.log("");

  console.log("→ Building application...");
  const strategy = new NestjsBuild({
    appPath: path.join(appPath, "packages", "api"),
  });

  const region = process.env.PRISMA_REGION || "us-east-1";
  const appId = process.env.PRISMA_APP_ID || "cps_cmrfcrfjq1g65wfdvx0g77d3v";

  console.log("→ Deploying to Prisma Compute...");
  console.log(`  Project: ${projectId}`);
  console.log(`  App ID: ${appId}`);
  console.log(`  Service: @vellum/api`);
  console.log(`  Region: ${region}`);
  console.log("");

  const result = await compute.deploy({
    strategy,
    projectId,
    appId,
    appName: "@vellum/api",
    region,
    envVars: {
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL || undefined,
      DIRECT_URL: process.env.DIRECT_URL || undefined,
      JWT_SECRET: process.env.JWT_SECRET || undefined,
      CORS_ORIGIN: process.env.CORS_ORIGIN || undefined,
      BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || undefined,
      PORT: "3000",
    },
    portMapping: { http: 3000 },
    timeoutSeconds: 600,
    progress: {
      onBuildStart: () => console.log("  [build] Starting build..."),
      onBuildComplete: () => console.log("  [build] Build complete"),
      onUploadStart: () => console.log("  [upload] Uploading artifact..."),
      onUploadComplete: () => console.log("  [upload] Upload complete"),
      onStatusChange: (status) => console.log(`  [deploy] Status: ${status}`),
      onRunning: (url) => console.log(`  [deploy] Running at ${url}`),
      onPromoted: (domain) => console.log(`  [deploy] Promoted to ${domain}`),
    },
  });

  if (result.isOk()) {
    const { deploymentId, deploymentEndpointDomain, appEndpointDomain, promoted } = result.value;
    console.log("");
    console.log("========================================");
    console.log("  Deployment successful!");
    console.log("========================================");
    console.log("");
    console.log(`  Deployment ID: ${deploymentId}`);
    console.log(`  Deployment URL: https://${deploymentEndpointDomain}`);
    if (appEndpointDomain) {
      console.log(`  App URL: https://${appEndpointDomain}`);
    }
    console.log(`  Promoted: ${promoted ? "yes" : "no"}`);
    console.log("");
  } else {
    console.error("");
    console.error("========================================");
    console.error("  Deployment failed");
    console.error("========================================");
    console.error("");
    console.error(`  Error: ${result.error.message}`);
    if (result.error.cause) {
      console.error(`  Cause: ${result.error.cause}`);
    }
    console.error("");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
