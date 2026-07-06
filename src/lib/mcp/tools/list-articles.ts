import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { articles } from "@/data/content";

export default defineTool({
  name: "list_articles",
  title: "List articles",
  description:
    "List published articles in Vellum with title, author, category, and slug. Optionally filter by category.",
  inputSchema: {
    category: z
      .string()
      .optional()
      .describe("Optional category filter, e.g. 'Culture', 'Design'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category, limit }) => {
    const filtered = category
      ? articles.filter((a) => a.category.toLowerCase() === category.toLowerCase())
      : articles;
    const items = filtered.slice(0, limit ?? 20).map((a) => ({
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: a.excerpt,
      author: a.author.name,
      publication: a.author.publication ?? null,
      readMinutes: a.readMinutes,
      publishedAgo: a.publishedAgo,
      likes: a.likes,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  },
});
