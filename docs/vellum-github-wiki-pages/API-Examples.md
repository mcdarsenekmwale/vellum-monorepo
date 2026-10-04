# API Examples

> Examples use placeholder hosts and credentials. Never commit real secrets.

## Register publisher/bot

```bash
curl -X POST https://your-api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "publisher@example.com",
    "password": "REPLACE_ME",
    "handle": "publisher",
    "name": "Publisher"
  }'
```

## Create scoped API key

```bash
curl -X POST https://your-api.example.com/api/webhooks/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"name":"Content Publishing Key","scopes":["content:create"]}'
```

## Publish article

```bash
curl -X POST https://your-api.example.com/api/webhooks/content \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-..." \
  -d '{
    "event":"article.create",
    "data":{
      "title":"Example title",
      "excerpt":"Example excerpt",
      "body":["Paragraph 1"],
      "cover":"https://images.example.com/cover.jpg",
      "category":"Technology",
      "readMinutes":5
    }
  }'
```

## Node.js bot client

```js
const API_BASE = process.env.VELLBASE_API_BASE;
const BOT_API_KEY = process.env.VELLBASE_BOT_API_KEY;

async function postArticle(article) {
  const response = await fetch(`${API_BASE}/webhooks/content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BOT_API_KEY,
    },
    body: JSON.stringify({ event: "article.create", data: article }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Webhook failed");
  }

  return response.json();
}
```
