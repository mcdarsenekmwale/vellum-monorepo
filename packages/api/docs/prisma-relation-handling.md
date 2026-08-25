# Prisma Relation Handling Guide

This document describes how foreign-key relations are updated in the Vellbase API, with a focus on support org entities (departments, teams, agents, tickets).

## Problem

When a Prisma model defines both a scalar FK field and a `@relation`, **update** operations must use relation syntax. Assigning the scalar FK directly causes:

```
PrismaClientValidationError: Unknown argument `departmentId`. Did you mean `department`?
```

**Create** operations may still accept scalar FKs (e.g. `departmentId: "..."`). **Update** operations must use:

```typescript
{ department: { connect: { id: departmentId } } }
// or
{ department: { disconnect: true } }
```

## Shared utilities

Location: `src/shared/prisma/`

| Module | Purpose |
|--------|---------|
| `relation-update.util.ts` | `buildRelationUpdate`, `assignRelationUpdate` |
| `relation-validation.util.ts` | `validateSupportDepartmentExists`, `validateSupportTeamExists`, `validateUserExists` |

### `buildRelationUpdate(id, options?)`

| Input | Result |
|-------|--------|
| `undefined` | `undefined` (omit — no change) |
| `null` | `{ disconnect: true }` (optional relations only) |
| `"uuid"` | `{ connect: { id: "uuid" } }` |

Pass `{ required: true }` when the relation cannot be cleared (e.g. `SupportTeam.department`).

### Example (service layer)

```typescript
import { assignRelationUpdate } from '../../shared/prisma/relation-update.util';
import { validateSupportDepartmentExists } from '../../shared/prisma/relation-validation.util';

const data: Record<string, unknown> = {};

if (patch.departmentId !== undefined) {
  if (patch.departmentId === null) {
    throw new BadRequestException('departmentId cannot be null');
  }
  await validateSupportDepartmentExists(this.prisma, patch.departmentId);
  assignRelationUpdate(data, 'department', patch.departmentId, { required: true });
}

await this.prisma.supportTeam.update({ where: { id }, data });
```

## API contract vs Prisma layer

HTTP clients continue to send scalar IDs (`departmentId`, `leadId`, `headId`). DTOs validate UUID format via class-validator. The service translates scalars into Prisma relation payloads before calling `update`.

## Models with relation fields (support module)

| Model | Relation fields | Required? |
|-------|-----------------|-----------|
| `SupportTeam` | `department`, `lead` | department required, lead optional |
| `SupportDepartment` | `head` | optional |
| `SupportAgent` | `department`, `team` | both optional |
| `SupportTicket` | `assignee`, `department`, `team`, `category`, `slaPolicy` | all optional except `user` |

## Migration checklist for other services

1. Search for `data.<fkField> =` inside `*.update()` calls where a `@relation` exists.
2. Replace with `assignRelationUpdate(data, '<relationName>', patch.<fkField>)`.
3. Remove duplicate scalar FK assignments when relation syntax is present.
4. Add existence validation before `connect`.
5. Add unit tests asserting `data.<relation>` shape and absence of scalar FK in update payloads.

## Testing scenarios (PATCH `/api/support/teams/:id`)

| Request body | Expected behavior |
|--------------|-------------------|
| `{ "departmentId": "<valid-uuid>" }` | Team moved to department; no Prisma validation error |
| `{ "name": "New Name" }` | Name updated; department unchanged |
| `{ "departmentId": "<invalid>" }` | `404` — department not found |
| `{ "departmentId": null }` | `400` — team must belong to a department |
| `{ "name": "...", "departmentId": "..." }` | All fields updated via relation syntax |

## Rollback

No database migration is required. Revert service-layer changes only. Existing rows and FK columns are unchanged.
