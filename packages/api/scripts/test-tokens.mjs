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

function getPlatformCliToken() {
  const authPath = path.join(
    os.homedir(),
    "Library/Preferences/prisma-platform-cli/auth.json"
  );
  try {
    const content = fs.readFileSync(authPath, "utf-8");
    const data = JSON.parse(content);
    return data.token || data.accessToken || null;
  } catch (e) {
    return null;
  }
}

async function testToken(name, token) {
  if (!token) {
    console.log(`${name}: No token found`);
    return;
  }
  
  console.log(`\n=== Testing ${name} ===`);
  console.log(`Token starts with: ${token.substring(0, 20)}...`);
  
  try {
    const apiClient = createManagementApiClient({ token });
    const compute = new ComputeClient(apiClient);
    
    const result = await compute.listProjects();
    if (result.isOk()) {
      console.log(`Success! Found ${result.value.length} project(s):`);
      for (const p of result.value) {
        console.log(`  - ${p.name} (${p.id})`);
      }
    } else {
      console.log(`Failed: ${result.error.message}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  const prismaToken = getPrismaAuthToken();
  const platformToken = getPlatformCliToken();
  
  await testToken("prisma/auth.json", prismaToken);
  await testToken("prisma-platform-cli/auth.json", platformToken);
}

main().catch(console.error);
