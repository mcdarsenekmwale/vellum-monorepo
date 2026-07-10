import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authors, articles } from "@/data/content";

export default defineTool({
  name: "list_authors",
  title: "List authors",
  description: "List authors and publications on Vellum, with their article counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const items = authors.map((a) => ({
      id: a.id,
      name: a.name,
      handle: a.handle,
      publication: a.publication ?? null,
      bio: a.bio ?? null,
      articleCount: articles.filter((art) => art.author.id === a.id).length,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  },
});

// z is imported for consistency across tool files.
void z;
