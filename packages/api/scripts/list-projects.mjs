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

  console.log("Using token from:", process.env.PRISMA_API_TOKEN ? "env" : "auth file");
  console.log("Token preview:", token.substring(0, 30) + "...");

  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  console.log("\nListing projects...");
  const projectsResult = await compute.listProjects();
  if (projectsResult.isErr()) {
    console.error("Failed to list projects:", projectsResult.error.message);
    process.exit(1);
  }

  const projects = projectsResult.value;
  console.log(`Found ${projects.length} project(s):`);
  for (const project of projects) {
    console.log("---");
    console.log("Project:", JSON.stringify(project, null, 2));

    console.log("\nApps:");
    const appsResult = await compute.listApps({ projectId: project.id });
    if (appsResult.isOk()) {
      for (const app of appsResult.value) {
        console.log("  App:", JSON.stringify(app, null, 2));

        console.log("  Deployments (last 5):");
        const depsResult = await compute.listDeployments({ appId: app.id });
        if (depsResult.isOk()) {
          for (const dep of depsResult.value.slice(0, 5)) {
            console.log("    Deployment:", JSON.stringify(dep, null, 2));
          }
        } else {
          console.log("    Error:", depsResult.error.message);
        }
      }
    } else {
      console.log("  Error:", appsResult.error.message);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
