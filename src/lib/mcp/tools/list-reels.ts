import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { reels } from "@/data/content";

export default defineTool({
  name: "list_reels",
  title: "List reels",
  description: "List short-form reels ('Atmospherics') with title, handle, and like count.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ limit }) => {
    const items = reels.slice(0, limit ?? 20).map((r) => ({
      id: r.id,
      title: r.title,
      handle: r.handle,
      likes: r.likes,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  },
});
