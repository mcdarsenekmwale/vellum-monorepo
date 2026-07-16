import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function getPrismaToken(): string | null {
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

  const { ComputeClient } = await import("@prisma/compute-sdk");
  const { createManagementApiClient } = await import("@prisma/management-api-sdk");

  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  console.log("Listing projects...");
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
  console.error("Error:", err);
  process.exit(1);
});
