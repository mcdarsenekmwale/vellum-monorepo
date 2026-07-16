import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { ComputeClient, NestjsBuild } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, "..", "..", "..");

function getPlatformCliToken() {
  const authPath = path.join(
    os.homedir(),
    "Library/Preferences/prisma-platform-cli/auth.json"
  );
  try {
    const content = fs.readFileSync(authPath, "utf-8");
    const data = JSON.parse(content);
    return data.token || data.accessToken || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN || getPlatformCliToken();
  if (!apiToken) {
    console.error("Error: No Prisma API token found");
    process.exit(1);
  }

  const projectId = process.env.PRISMA_PROJECT_ID || "cmrbpoqgp0b6srmdzdgg9936j";

  const apiClient = createManagementApiClient({
    token: apiToken,
  });

  const compute = new ComputeClient(apiClient);

  console.log("========================================");
  console.log("  Prisma Compute — API Deploy (CLI)");
  console.log("========================================");
  console.log("");
  console.log(`Project ID: ${projectId}`);
  console.log("");

  console.log("→ Building application...");
  const strategy = new NestjsBuild({
    appPath: path.join(rootPath, "packages", "api"),
  });

  const region = process.env.PRISMA_REGION || "us-east-1";

  console.log("→ Deploying to Prisma Compute...");
  console.log(`  Region: ${region}`);
  console.log("");

  const result = await compute.deploy({
    strategy,
    projectId,
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
      onArchiveCreating: () => console.log("  [archive] Creating archive..."),
      onArchiveReady: (size) => console.log(`  [archive] Ready (${(size / 1024 / 1024).toFixed(1)} MB)`),
      onUploadStart: () => console.log("  [upload] Uploading artifact..."),
      onUploadComplete: () => console.log("  [upload] Upload complete"),
      onDeploymentCreated: (id) => console.log(`  [deploy] Deployment created: ${id}`),
      onStatusChange: (status) => console.log(`  [deploy] Status: ${status}`),
      onRunning: (url) => console.log(`  [deploy] Running at ${url}`),
      onPromoteStart: () => console.log("  [promote] Promoting..."),
      onPromoted: (domain) => console.log(`  [promote] Promoted to ${domain}`),
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
  console.error(err.stack);
  process.exit(1);
});
