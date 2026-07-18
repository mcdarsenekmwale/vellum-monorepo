import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function getToken() {
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

const API_BASE = "https://api.prisma.io";

async function api(token, method, path, body = null) {
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
    console.error(`  API ${method} ${path} failed: ${res.status}`);
    console.error(`  ${JSON.stringify(data, null, 2).slice(0, 500)}`);
    throw new Error(`API ${method} ${path} failed: ${res.status}`);
  }
  return data;
}

function maskUrl(url) {
  return url.replace(/(postgresql?:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

async function main() {
  const token = getToken();
  if (!token) {
    console.error("No Prisma API token found");
    process.exit(1);
  }

  const dbId = "db_cmoiqkwls0y2410o6kwtqrzte";
  console.log("=== Database Details ===");
  const db = await api(token, "GET", `/v1/databases/${dbId}`);
  console.log(JSON.stringify(db, null, 2));

  console.log("\n=== Database Connections ===");
  const conns = await api(token, "GET", `/v1/databases/${dbId}/connections`);
  for (const c of conns.data || []) {
    console.log(`\n--- Connection: ${c.name} (${c.id}) ---`);
    console.log(`  Kind: ${c.kind}`);
    console.log(`  Endpoints:`);
    console.log(`    Direct: ${c.endpoints?.direct?.host}:${c.endpoints?.direct?.port}`);
    console.log(`    Pooled: ${c.endpoints?.pooled?.host}:${c.endpoints?.pooled?.port}`);
  }

  // Get a specific connection with full URL
  const firstConnId = conns.data?.[0]?.id;
  if (firstConnId) {
    console.log(`\n=== Connection Detail: ${firstConnId} ===`);
    const connDetail = await api(token, "GET", `/v1/connections/${firstConnId}`);
    if (connDetail.data?.connectionString) {
      console.log(`  Connection string: ${maskUrl(connDetail.data.connectionString)}`);
    }
    console.log(JSON.stringify(connDetail, null, 2).replace(
      /(postgresql?:\/\/[^:]+:)[^@]+(@)/g,
      "$1***$2"
    ).slice(0, 2000));
  }

  // Check projects to find the right one
  console.log("\n=== Projects ===");
  const projects = await api(token, "GET", "/v1/projects");
  for (const p of projects.data || []) {
    console.log(`  ${p.name} (${p.id})`);
  }

  // Check usage
  console.log("\n=== Usage ===");
  try {
    const usage = await api(token, "GET", `/v1/databases/${dbId}/usage`);
    console.log(JSON.stringify(usage, null, 2).slice(0, 1500));
  } catch (e) {
    console.log("  Failed:", e.message);
  }

  // Try creating a new connection to get fresh credentials
  console.log("\n=== Creating new connection (direct) ===");
  try {
    const newConn = await api(token, "POST", `/v1/databases/${dbId}/connections`, {
      name: `sync-script-${Date.now()}`,
      type: "direct",
    });
    console.log("New connection created:");
    console.log(JSON.stringify(newConn, null, 2).replace(
      /(postgresql?:\/\/[^:]+:)[^@]+(@)/g,
      "$1***$2"
    ));
    if (newConn.data?.connectionString) {
      console.log("\nDIRECT_URL (masked):", maskUrl(newConn.data.connectionString));
    }
  } catch (e) {
    console.log("  Failed:", e.message);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
