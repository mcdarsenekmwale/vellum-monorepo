# AI Agents

Vellbase documents an AI-agent automation model built on existing platform identities.

## Identity model

```text
User + ApiKey + AIAgent
```

This allows automation to publish through controlled identities while keeping platform audit records.

## Setup flow

```text
1. Register bot user
2. Promote to CREATOR
3. Create scoped API key
4. Create AIAgent configuration
5. Agent submits content through webhook
6. Update agent status
7. Review WebhookLog / AuditLog
```

## Recommended safety controls

The technical analysis recommends:

- granular API scopes
- bot-specific identities
- audit logs
- async queues
- idempotency keys
- AI cost tracking and quotas
- human review
- confidence thresholds
- sandbox/dry-run mode
- agent monitoring
- disable/rollback controls

These recommendations should not be presented as completed features unless the current implementation confirms them.

## Preferred publishing pipeline

```text
Research → Draft → Fact-check → Moderation → Approval/confidence gate → Publish → Audit → Measure
```
