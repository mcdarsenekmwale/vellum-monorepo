import "dotenv/config";
import { ComputeClient, NestjsBuild, Ok } from "@prisma/compute-sdk";
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
  
  let existingAppId: string | null = null;
  
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

  if (existingAppId) {
    console.log(`\n→ Updating existing app ${existingAppId}...`);
  }

  console.log("\n→ Building application...");
  const strategy = new NestjsBuild({
    appPath: ".",  // working directory is already packages/api
  });

  console.log("→ Deploying to Prisma Compute...");
  console.log(`  Project: ${projectId}`);
  console.log(`  Service: @vellum/api`);
  console.log(`  Region: us-east-1`);
  console.log("");

  const result = await compute.deploy({
    strategy,
    projectId,
    appId: existingAppId || undefined,
    appName: "@vellum/api",
    region: "us-east-1",
    envVars: {
      NODE_ENV: "production",
      JWT_SECRET: process.env.JWT_SECRET || undefined,
      CORS_ORIGIN: process.env.CORS_ORIGIN || undefined,
      BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || undefined,
      REDIS_URL: process.env.REDIS_URL || undefined,
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
  });

  if (result.isOk()) {
    const { deploymentId, deploymentEndpointDomain, appEndpointDomain, promoted } = result.value;
    const formatUrl = (domain: string) => 
      domain.startsWith("http") ? domain : `https://${domain}`;
    console.log("");
    console.log("========================================");
    console.log("  ✅ Deployment successful!");
    console.log("========================================");
    console.log("");
    console.log(`  Deployment ID: ${deploymentId}`);
    console.log(`  Deployment URL: ${formatUrl(deploymentEndpointDomain)}`);
    if (appEndpointDomain) {
      console.log(`  App URL: ${formatUrl(appEndpointDomain)}`);
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
