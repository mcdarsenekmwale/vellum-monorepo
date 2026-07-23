import "dotenv/config";
import { streamLogs } from "@prisma/compute-sdk";

async function main() {
  const apiToken = process.env.PRISMA_API_TOKEN;
  if (!apiToken) {
    console.error("Error: PRISMA_API_TOKEN environment variable is required");
    process.exit(1);
  }

  const deploymentId = process.argv[2] || "cpv_plchgh4vfqzicjd561n40dtz";
  
  console.log(`Streaming logs for deployment: ${deploymentId}`);
  console.log("========================================");
  
  const result = await streamLogs(
    {
      baseUrl: "https://api.prisma.io",
      token: apiToken,
      deploymentId,
      tail: 100,
      fromStart: true,
    },
    (record) => {
      if (record.type === "log") {
        console.log(record.text);
      } else if (record.type === "terminal") {
        console.log(`\n[TERMINAL: ${record.kind}] ${record.code}: ${record.message}`);
        if (record.details) {
          console.log("Details:", JSON.stringify(record.details, null, 2));
        }
      }
    }
  );

  console.log("========================================");
  if (result.isOk()) {
    console.log("Stream completed successfully");
    console.log("Last byte end:", result.value.lastByteEnd);
  } else {
    console.error("Stream error:", result.error.message);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
