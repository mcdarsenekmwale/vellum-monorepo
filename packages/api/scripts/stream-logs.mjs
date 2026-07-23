import "dotenv/config";
import WebSocket from "ws";
import fs from "fs";

const deploymentId = process.argv[2] || "cpv_xz5173ze61khytthyczhl8g7";
const token = process.env.PRISMA_API_TOKEN;

if (!token) {
  console.error("PRISMA_API_TOKEN is required");
  process.exit(1);
}

const wsUrl = `wss://api.prisma.io/v1/deployments/${deploymentId}/logs?tail=500&from_start=true`;

const allLogs = [];

console.log(`Connecting to log stream for deployment: ${deploymentId}`);

const ws = new WebSocket(wsUrl, {
  headers: { Authorization: `Bearer ${token}` },
});

let messageCount = 0;

ws.on("open", () => {
  console.log("Connected to log stream");
  console.log("---");
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.type === "log") {
      const cleanText = message.text.replace(/\r/g, "\n").replace(/\x1b\[[0-9;]*m/g, "");
      allLogs.push(cleanText);
      process.stdout.write(cleanText);
    } else if (message.type === "terminal") {
      console.log("\n--- TERMINAL ---");
      console.log(`Kind: ${message.kind}`);
      console.log(`Code: ${message.code}`);
      console.log(`Message: ${message.message}`);
      if (message.details) {
        console.log("Details:", JSON.stringify(message.details, null, 2));
      }
      allLogs.push(`\n--- TERMINAL: ${message.kind} - ${message.code} - ${message.message}\n`);
    }
    
    messageCount++;
  } catch (e) {
    console.log("Raw message:", data.toString());
  }
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error.message);
});

ws.on("close", (code, reason) => {
  console.log("---");
  console.log(`Connection closed (code: ${code}, reason: ${reason})`);
  console.log(`Total messages received: ${messageCount}`);
  
  fs.writeFileSync("/tmp/deploy-logs-clean.txt", allLogs.join(""));
  console.log("Logs saved to /tmp/deploy-logs-clean.txt");
  
  process.exit(0);
});

setTimeout(() => {
  console.log("\n--- Timeout after 60 seconds ---");
  ws.close();
}, 60000);
