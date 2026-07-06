import { defineMcp } from "@lovable.dev/mcp-js";
import listArticles from "./tools/list-articles";
import getArticle from "./tools/get-article";
import searchArticles from "./tools/search-articles";
import listReels from "./tools/list-reels";
import listAuthors from "./tools/list-authors";

export default defineMcp({
  name: "vellum-mcp",
  title: "Vellum",
  version: "0.1.0",
  instructions:
    "Read-only access to Vellum's editorial content: articles, reels, and authors. Use `search_articles` to find stories, `get_article` for full body text, `list_articles` to browse (optionally by category), `list_reels` for short-form atmospherics, and `list_authors` for writers and publications.",
  tools: [listArticles, getArticle, searchArticles, listReels, listAuthors],
});
