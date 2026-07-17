import "dotenv/config";
import { ComputeClient, CustomBuild, Ok } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  if (!apiToken) {
    console.error("Error: PRISMA_API_TOKEN environment variable is required");
    process.exit(1);
  }

  const projectId = process.env.PRISMA_PROJECT_ID;
  if (!projectId) {
    console.error("Error: PRISMA_PROJECT_ID environment variable is required");
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

  // List existing apps to find ours
  console.log("→ Checking existing apps...");
  const appsResult = await compute.listApps({ projectId });
  
  let existingAppId: string | undefined;
  
  if (appsResult.isOk()) {
    const apps = appsResult.value;
    console.log(`  Found ${apps.length} existing apps`);
    for (const app of apps) {
      console.log(`  - ${app.name} (${app.id}) branch=${(app as any).branchId || 'unknown'}`);
      if (app.name === "@vellum/api") {
        existingAppId = app.id;
        console.log(`  → Found existing app: ${app.id}`);
      }
    }
  } else {
    console.log("  Could not list apps:", appsResult.error.message);
  }

  // If app exists on a different branch, delete it first
  if (existingAppId) {
    console.log("\n→ Deleting existing app to redeploy...");
    const deleteResult = await compute.deleteApp({ appId: existingAppId });
    if (deleteResult.isOk()) {
      console.log("  App deleted successfully");
      existingAppId = undefined;
    } else {
      console.log("  Warning: Could not delete app:", deleteResult.error.message);
      console.log("  Attempting to deploy using existing appId...");
    }
  }

  console.log("\n→ Building application...");
  const strategy = new CustomBuild({
    appPath: "packages/api",
    entrypoint: "dist/src/main.js",
  });

  console.log("→ Deploying to Prisma Compute...");
  console.log(`  Project: ${projectId}`);
  console.log(`  Service: @vellum/api`);
  console.log(`  Region: us-east-1`);
  if (existingAppId) {
    console.log(`  Existing App ID: ${existingAppId}`);
  }
  console.log("");

  const deployOpts: any = {
    strategy,
    projectId,
    appName: "@vellum/api",
    region: "us-east-1",
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
    timeoutSeconds: 300,
    progress: {
      onBuildStart: () => console.log("  [build] Starting build..."),
      onBuildComplete: () => console.log("  [build] Build complete"),
      onUploadStart: () => console.log("  [upload] Uploading artifact..."),
      onUploadComplete: () => console.log("  [upload] Upload complete"),
      onStatusChange: (status: string) => console.log(`  [deploy] Status: ${status}`),
      onRunning: (url: string) => console.log(`  [deploy] Running at ${url}`),
    },
  };

  if (existingAppId) {
    deployOpts.appId = existingAppId;
  }

  const result = await compute.deploy(deployOpts);

  if (result.isOk()) {
    const { deploymentId, deploymentEndpointDomain, appEndpointDomain, promoted } = result.value;
    console.log("");
    console.log("========================================");
    console.log("  ✅ Deployment successful!");
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
    console.error("  ❌ Deployment failed");
    console.error("========================================");
    console.error("");
    console.error(`  Error: ${result.error.message}`);
    console.error("");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
