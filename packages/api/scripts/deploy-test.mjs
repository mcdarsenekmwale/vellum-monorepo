import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { ComputeClient, NestjsBuild } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

function getPrismaToken() {
  const cliAuthPath = path.join(
    os.homedir(),
    "Library/Preferences/prisma-platform-cli/auth.json"
  );
  try {
    const content = fs.readFileSync(cliAuthPath, "utf-8");
    const data = JSON.parse(content);
    if (data.token) {
      return data.token;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function main() {
  const token = process.env.PRISMA_API_TOKEN || getPrismaToken();
  if (!token) {
    console.error("No Prisma token found");
    process.exit(1);
  }

  const projectId = process.env.PRISMA_PROJECT_ID || "proj_cmoiqkwls0y2610o6jobkqjtg"; // Mvalex Business Suite
  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  const rootDir = path.resolve(process.cwd(), "..", "..");
  const appPath = path.join(rootDir, "packages", "api");
  
  console.log("Project ID:", projectId);
  console.log("App path:", appPath);
  console.log("Root dir:", rootDir);
  console.log("");

  console.log("Starting deployment with NestjsBuild strategy...");
  console.log("This may take a few minutes...");
  console.log("");

  const result = await compute.deploy({
    projectId,
    appName: "vellbase-api-test",
    region: "ap-southeast-1",
    strategy: new NestjsBuild({
      appPath,
    }),
    envVars: {
      DATABASE_URL: process.env.DATABASE_URL || "",
      DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
      JWT_SECRET: process.env.JWT_SECRET || "test-secret-change-me",
      CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
      BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || "10",
      NODE_ENV: "production",
    },
    progress: {
      onBuildStart: () => console.log("[1/5] Building NestJS app..."),
      onBuildComplete: () => console.log("[2/5] Build complete."),
      onArchiveCreating: () => console.log("[3/5] Creating artifact archive..."),
      onArchiveReady: (bytes) => console.log(`[4/5] Archive ready (${(bytes / 1024 / 1024).toFixed(1)} MB). Uploading...`),
      onUploadStart: () => console.log("[5/5] Uploading to Prisma Compute..."),
      onDeploymentCreated: (id) => console.log(`Deployment created: ${id}`),
    },
  });

  if (result.isErr()) {
    console.error("\nDeployment failed:");
    console.error("  Error:", result.error.message);
    console.error("  Type:", result.error.name);
    process.exit(1);
  }

  const deployment = result.value;
  console.log("\nDeployment submitted!");
  console.log("  ID:", deployment.id);
  console.log("  Status:", deployment.status);
  console.log("  Preview URL:", deployment.previewDomain || "N/A");
  console.log("  App URL:", deployment.appEndpointDomain || "N/A");

  console.log("\nWaiting for deployment to start...");
  let lastStatus = deployment.status;
  const startTime = Date.now();
  const timeoutMs = 30 * 60 * 1000; // 30 min

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const statusResult = await compute.getDeployment({ deploymentId: deployment.id });
    if (statusResult.isErr()) {
      process.stdout.write("?");
      continue;
    }

    const dep = statusResult.value;
    if (dep.status !== lastStatus) {
      console.log(`\nStatus: ${lastStatus} -> ${dep.status}`);
      lastStatus = dep.status;
    }

    if (dep.status === "running") {
      console.log("\n=== Deployment succeeded! ===");
      console.log("Deployment ID:", dep.id);
      console.log("Preview URL:", dep.previewDomain || "N/A");
      console.log("App URL:", dep.appEndpointDomain || "N/A");
      console.log("");
      
      if (dep.previewDomain) {
        console.log("Testing health endpoint...");
        try {
          const health = await fetch(`https://${dep.previewDomain}/api/health`);
          const data = await health.json();
          console.log("Health:", JSON.stringify(data, null, 2));
        } catch (e) {
          console.log("Health check failed (might still be starting):", e.message);
        }
      }
      break;
    }

    if (dep.status === "failed" || dep.status === "error") {
      console.error("\n=== Deployment failed ===");
      console.error("Status:", dep.status);
      console.error("Details:", JSON.stringify(dep, null, 2));
      
      const logsResult = await compute.getDeploymentLogs({ deploymentId: deployment.id });
      if (logsResult.isOk()) {
        console.error("\n=== Build logs ===");
        console.error(logsResult.value);
      }
      
      process.exit(1);
    }

    process.stdout.write(".");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
