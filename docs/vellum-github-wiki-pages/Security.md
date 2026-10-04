# Security

## Baseline

The README documents no committed secrets, environment-variable configuration and automated security audits in CI.

## API controls

Documented controls include:

- JWT authentication
- Role-based authorization
- Helmet security headers
- Configurable CORS
- Input validation
- Global exception handling
- Scoped API keys for automation
- Audit logging

## Automation

Use the following boundary for automated agents:

```text
AI agent
 ↓
Scoped API key
 ↓
Specific webhook scope
 ↓
Audited action
```

For high-risk automation, add human approval, confidence gates, sandbox/dry-run capability, idempotency, rate limits and a kill switch.

## Secret handling

Never commit `.env` files, database passwords, API keys, JWT secrets, cloud credentials, refresh tokens or webhook secrets.

## Incident response

1. Revoke compromised credentials.
2. Disable the affected bot/agent.
3. Review webhook and audit logs.
4. Rotate dependent secrets.
5. Identify affected resources.
6. Restore a known-good deployment if required.
7. Document the incident and preventive action.
