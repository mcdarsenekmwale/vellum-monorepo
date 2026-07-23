import "dotenv/config";
import { ComputeClient } from "@prisma/compute-sdk";
import { createManagementApiClient } from "@prisma/management-api-sdk";

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  const projectId = process.env.PRISMA_PROJECT_ID;
  const deploymentId = process.argv[2];

  if (!apiToken || !projectId || !deploymentId) {
    console.error("Usage: PRISMA_API_TOKEN=xxx PRISMA_PROJECT_ID=xxx bun scripts/restart-deployment.ts <deploymentId>");
    process.exit(1);
  }

  const apiClient = createManagementApiClient({ token: apiToken });
  const compute = new ComputeClient(apiClient);

  console.log(`Stopping deployment ${deploymentId}...`);
  const stopResult = await compute.stopDeployment({ deploymentId });
  if (stopResult.isErr()) {
    console.error("Stop error:", stopResult.error.message);
    process.exit(1);
  }
  console.log("Stop requested successfully");

  console.log("Waiting 10 seconds...");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`Starting deployment ${deploymentId}...`);
  const startResult = await compute.startDeployment({ deploymentId });
  if (startResult.isErr()) {
    console.error("Start error:", startResult.error.message);
    process.exit(1);
  }
  console.log("Start requested successfully");

  console.log("Waiting for deployment to start...");
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusResult = await compute.showDeployment({ deploymentId });
    if (statusResult.isOk()) {
      console.log(`Status (${i + 1}/30): ${statusResult.value.status}`);
      if (statusResult.value.status === "running") {
        console.log("Deployment is running!");
        break;
      }
    } else {
      console.error("Status check error:", statusResult.error.message);
    }
  }
}

main().catch(console.error);
