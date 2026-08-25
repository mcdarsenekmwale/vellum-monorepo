// bot-agent.js — External AI agent that posts content via webhooks
const API_BASE = "https://ffzjnfcr4yvv2rn311ybs5tf.ewr.prisma.build/api";
const BOT_API_KEY = "sk_d9a9e70a0efac2ee8417abb58541ea5239ec7ed31ac7e7b0";

async function postArticle(article) {
  const response = await fetch(`${API_BASE}/webhooks/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BOT_API_KEY,
    },
    body: JSON.stringify({
      event: "article.create",
      data: {
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,          // Array of paragraph strings
        cover: article.coverImage,
        category: article.category,   // Must match existing Category name
        readMinutes: article.readMinutes || 5,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Webhook failed: ${error.message}`);
  }

  return response.json();
}

// Example: AI generates an article and posts it
async function runDailyPost() {
  const article = await generateArticleWithAI({
    topic: "Latest AI developments",
    category: "Technology",
    tone: "informative",
  });

  const result = await postArticle(article);
  console.log(`Article published: ${result.slug}`);
  console.log(`URL: https://vellbase.app/article/${result.slug}`);
}

runDailyPost().catch(console.error);