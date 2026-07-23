import "dotenv/config";
import { ComputeClient } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  const projectId = process.env.PRISMA_PROJECT_ID;
  const appId = process.argv[2];

  if (!apiToken || !projectId || !appId) {
    console.error("Usage: PRISMA_API_TOKEN=xxx PRISMA_PROJECT_ID=xxx bun scripts/promote-app.ts <appId>");
    process.exit(1);
  }

  const apiClient = createManagementApiClient({ token: apiToken });
  const compute = new ComputeClient(apiClient);

  console.log(`Promoting app ${appId}...`);
  
  const result = await (compute as any).promoteApp({ appId, projectId });
  
  if (result.isOk()) {
    console.log("Promote successful!");
    console.log(JSON.stringify(result.value, null, 2));
  } else {
    console.error("Promote error:", result.error.message);
  }
}

main().catch(console.error);
