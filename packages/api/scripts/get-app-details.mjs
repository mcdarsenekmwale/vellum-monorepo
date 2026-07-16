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
  const appId = "cps_cmrfcrfjq1g65wfdvx0g77d3v";

  console.log("Getting app details...");
  console.log(`Project: ${projectId}`);
  console.log(`App: ${appId}`);
  console.log("");

  try {
    const result = await compute.showApp({ projectId, appId });
    if (result.isOk()) {
      const app = result.value;
      console.log("App details:");
      console.log(JSON.stringify(app, null, 2));
    } else {
      console.error("Failed:", result.error.message);
    }
  } catch (e) {
    console.error("Error:", e.message);
    console.error(e.stack);
  }
}

main().catch(console.error);
