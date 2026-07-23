import "dotenv/config";

const API_BASE = "https://api.prisma.io";
const token = process.env.PRISMA_API_TOKEN;
const projectId = process.env.PRISMA_PROJECT_ID;

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    console.error(`API ${method} ${path} failed: ${res.status}`);
    console.error(JSON.stringify(data, null, 2).slice(0, 500));
    throw new Error(`API ${method} ${path} failed: ${res.status}`);
  }
  return data;
}

async function main() {
  console.log("Checking deployments...");
  const deployments = await api("GET", `/v1/projects/${projectId}/deployments`);
  console.log("Deployments:", JSON.stringify(deployments, null, 2).slice(0, 1000));
  
  console.log("\nChecking apps...");
  const apps = await api("GET", `/v1/projects/${projectId}/apps`);
  console.log("Apps:", JSON.stringify(apps, null, 2).slice(0, 1000));
}

main().catch(e => console.error(e));
