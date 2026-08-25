import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function getToken(): string {
  const platformPath = path.join(
    os.homedir(),
    "Library/Preferences/prisma-platform-cli/auth.json"
  );
  try {
    const content = fs.readFileSync(platformPath, "utf-8");
    const data = JSON.parse(content);
    if (data.token) return data.token;
  } catch {}

  return process.env.PRISMA_API_TOKEN || "";
}

async function main() {
  const token = getToken();
  if (!token) {
    console.error("No token found");
    process.exit(1);
  }

  const { ComputeClient } = await import("@prisma/compute-sdk");
  const { createManagementApiClient } = await import("@prisma/management-api-sdk");

  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  // List all projects
  console.log("=== Listing Projects ===");
  const projectsResult = await compute.listProjects();
  if (projectsResult.isErr()) {
    console.error("Failed to list projects:", projectsResult.error.message);
    process.exit(1);
  }

  const projects = projectsResult.value;
  console.log(`Found ${projects.length} project(s):`);
  for (const project of projects) {
    console.log(`\n--- Project: ${project.name} (${project.id}) ---`);
    console.log("  Full data:", JSON.stringify(project, null, 2));

    // List apps
    const appsResult = await compute.listApps({ projectId: project.id });
    if (appsResult.isErr()) {
      console.log("  Error listing apps:", appsResult.error.message);
      continue;
    }

    for (const app of appsResult.value) {
      console.log(`\n  App: ${app.name} (${app.id})`);
      console.log("  Full app data:", JSON.stringify(app, null, 2));

      // List deployments
      const depsResult = await compute.listDeployments({ appId: app.id });
      if (depsResult.isOk()) {
        for (const dep of depsResult.value.slice(0, 1)) {
          console.log("  Latest deployment:", JSON.stringify(dep, null, 2));
        }
      }
    }
  }

  // Try to get the Vellbase project apps directly
  const vellbaseProjectId = process.env.PRISMA_PROJECT_ID || "cmrbpoqgp0b6srmdzdgg9936j";
  console.log(`\n=== Trying Vellbase project: ${vellbaseProjectId} ===`);
  try {
    const appsResult = await compute.listApps({ projectId: vellbaseProjectId });
    if (appsResult.isOk()) {
      console.log("Apps:", JSON.stringify(appsResult.value, null, 2));
      for (const app of appsResult.value) {
        const depsResult = await compute.listDeployments({ appId: app.id });
        if (depsResult.isOk()) {
          for (const dep of depsResult.value.slice(0, 2)) {
            console.log("  Deployment:", JSON.stringify(dep, null, 2));
          }
        }
      }
    } else {
      console.log("Error:", appsResult.error.message);
    }
  } catch (e: any) {
    console.log("Exception:", e.message);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
