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

  const deploymentId = process.argv[2] || "cpv_z2u8lwgq5ubf9n82dobnwrw2";
  
  const apiClient = createManagementApiClient({ token });
  const compute = new ComputeClient(apiClient);

  console.log(`Getting details for deployment: ${deploymentId}`);
  const result = await compute.showDeployment({ deploymentId });
  
  if (result.isErr()) {
    console.error("Failed:", result.error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(result.value, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
