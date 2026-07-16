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

  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  const projectId = "proj_cmoiqkwls0y2610o6jobkqjtg"; // Mvalex Business Suite
  console.log(`Listing apps for project: ${projectId}`);
  
  const appsResult = await compute.listApps({ projectId });
  if (appsResult.isErr()) {
    console.error("Failed to list apps:", appsResult.error.message);
    process.exit(1);
  }

  console.log(`Found ${appsResult.value.length} app(s):`);
  for (const app of appsResult.value) {
    console.log("---");
    console.log("App:", JSON.stringify(app, null, 2));
    
    console.log("  Deployments (last 10):");
    const depsResult = await compute.listDeployments({ appId: app.id });
    if (depsResult.isOk()) {
      for (const dep of depsResult.value.slice(0, 10)) {
        console.log(`    - ${dep.id} (${dep.status})`);
        console.log(`      Created: ${dep.createdAt}`);
        console.log(`      Preview: ${dep.previewDomain || "N/A"}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
