import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import { ComputeClient } from "@prisma/compute-sdk";
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

  const projectId = process.env.PRISMA_PROJECT_ID || "proj_cmoiqkwls0y2610o6jobkqjtg";
  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  console.log("Listing apps...");
  const appsResult = await compute.listApps({ projectId });
  if (appsResult.isErr()) {
    console.error("Failed to list apps:", appsResult.error.message);
    process.exit(1);
  }

  for (const app of appsResult.value) {
    console.log(`\n=== App: ${app.name} (${app.id}) ===`);
    
    const depsResult = await compute.listDeployments({ appId: app.id });
    if (depsResult.isOk()) {
      for (const dep of depsResult.value.slice(0, 5)) {
        console.log(`  Deployment: ${dep.id}`);
        console.log(`    Status: ${dep.status}`);
        console.log(`    Created: ${dep.createdAt}`);
        console.log(`    Preview: ${dep.previewDomain || "N/A"}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
