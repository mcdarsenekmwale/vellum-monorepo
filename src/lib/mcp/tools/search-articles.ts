import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { articles } from "@/data/content";

export default defineTool({
  name: "search_articles",
  title: "Search articles",
  description: "Full-text search over article titles, excerpts, categories, and authors.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Search query."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query, limit }) => {
    const q = query.toLowerCase();
    const hits = articles
      .filter((a) =>
        [a.title, a.excerpt, a.category, a.author.name, a.author.publication ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, limit ?? 10)
      .map((a) => ({
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        author: a.author.name,
      }));
    return {
      content: [{ type: "text", text: JSON.stringify(hits, null, 2) }],
      structuredContent: { hits },
    };
  },
});
