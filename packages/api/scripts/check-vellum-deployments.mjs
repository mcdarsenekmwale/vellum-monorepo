import fs from "fs";
import path from "path";
import os from "os";
import { ComputeClient } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

function getPrismaAuthToken() {
  const authPath = path.join(
    os.homedir(),
    "Library/Application Support/prisma/auth.json"
  );
  try {
    const content = fs.readFileSync(authPath, "utf-8");
    const data = JSON.parse(content);
    if (data.tokens && data.tokens.length > 0) {
      return data.tokens[0].token;
    }
    return data.token || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const token = getPrismaAuthToken();
  if (!token) {
    console.error("No token found");
    process.exit(1);
  }

  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  const projectId = "proj_cmrbqbmdg0xkc0gf3uy3kzewy";

  console.log("Listing deployments...");
  const result = await compute.listDeployments({ projectId });
  
  if (result.isOk()) {
    console.log(`Found ${result.value.length} deployment(s):`);
    for (const d of result.value) {
      console.log(`  - ${d.id} | ${d.status} | ${d.appName} | ${d.previewDomain || 'no domain'}`);
    }
  } else {
    console.error("Failed:", result.error.message);
  }

  console.log("\nListing apps...");
  // Try to list apps
  try {
    const appsResult = await compute.listApps({ projectId });
    if (appsResult.isOk()) {
      console.log(`Found ${appsResult.value.length} app(s):`);
      for (const a of appsResult.value) {
        console.log(`  - ${a.name} (${a.id})`);
        console.log(`    Region: ${a.region}`);
        console.log(`    HTTP port: ${a.httpPort}`);
        console.log(`    Env vars: ${Object.keys(a.envVars || {}).join(', ')}`);
      }
    } else {
      console.error("Failed:", appsResult.error.message);
    }
  } catch (e) {
    console.error("Error listing apps:", e.message);
  }
}

main().catch(console.error);
