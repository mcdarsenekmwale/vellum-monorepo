import "dotenv/config";
import { ComputeClient } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  const projectId = process.env.PRISMA_PROJECT_ID;
  const deploymentId = process.argv[2];

  if (!apiToken || !projectId || !deploymentId) {
    console.error("Usage: PRISMA_API_TOKEN=xxx PRISMA_PROJECT_ID=xxx bun scripts/show-deployment.ts <deploymentId>");
    process.exit(1);
  }

  const apiClient = createManagementApiClient({ token: apiToken });
  const compute = new ComputeClient(apiClient);

  const result = await compute.showDeployment({ deploymentId });
  
  if (result.isOk()) {
    console.log("Deployment details:");
    console.log(JSON.stringify(result.value, null, 2));
  } else {
    console.error("Error:", result.error.message);
  }
}

main().catch(console.error);
