import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { articles } from "@/data/content";

export default defineTool({
  name: "get_article",
  title: "Get article",
  description: "Fetch the full body and metadata of one article by its slug.",
  inputSchema: {
    slug: z.string().min(1).describe("Article slug, e.g. 'serif-fonts-digital-design'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ slug }) => {
    const a = articles.find((x) => x.slug === slug);
    if (!a) {
      return {
        content: [{ type: "text", text: `No article found with slug "${slug}".` }],
        isError: true,
      };
    }
    const article = {
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: a.excerpt,
      body: a.body,
      cover: a.cover,
      readMinutes: a.readMinutes,
      publishedAgo: a.publishedAgo,
      likes: a.likes,
      author: {
        id: a.author.id,
        name: a.author.name,
        handle: a.author.handle,
        publication: a.author.publication ?? null,
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(article, null, 2) }],
      structuredContent: { article },
    };
  },
});
