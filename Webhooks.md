# Webhooks

Vellbase provides an integration boundary for external systems and automated content publishing.

## Incoming content endpoint

```http
POST /api/webhooks/content
x-api-key: sk-...
```

## Flow

```text
External system
 ↓
Content webhook
 ↓
API key validation
 ↓
Scope check
 ↓
WebhookLog
 ↓
Event router
 ↓
Content mutation
 ↓
Response
```

## Supported events

| Event | Action |
| --- | --- |
| `article.create` | Create article |
| `article.update` | Update article by slug |
| `article.delete` | Delete article by slug |
| `highlight.create` | Create video highlight |

## Security

The current documented protection uses API-key authentication, scope checking and logging. The technical analysis recommends HMAC request signatures as an additional authenticity control; treat that as a hardening recommendation unless the source confirms it is implemented.

## Outgoing webhooks

The technical documentation also contains an architectural proposal for queued outgoing delivery with a Bull queue. Verify current source before describing it as fully shipped.

## Best practices

- One key per automation system
- Minimum required scopes
- Server-side secret storage
- Rotation/revocation
- Audit logging
- Idempotent content operations
