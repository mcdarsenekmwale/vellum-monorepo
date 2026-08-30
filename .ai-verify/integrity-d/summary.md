# Sub-D Task 7 Integrity (5 subtests)

Runner: `bash .ai-verify/integrity-d/run-integrity.sh`

Environment:
- Postgres native `127.0.0.1:5432` / database `vellum_db` (trust auth)
- Test users all carry emails/handles LIKE `'test_d_%'` — each spec's
  `afterAll` hook prunes only those rows (never touches seeded users).
- Jest with `rootDir="."` + moduleNameMapper shims for
  `@nestjs/event-emitter` and `@nestjs/schedule` (ESM-to-CJS).

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Unique constraint duplicate raises P2002 | PASS | `prisma.user.create` duplicate email `test_d_uniq1@x.com` → caught `error.code === 'P2002'` explicitly. |
| 2 | Preferences 10x round-trip no drift | PASS | PUT random `quietHoursStart/End/cadence/group*` 10x → immediately GET after each. Final GET deep-equals last PUT payload. All 10 iterations + final GET match 0 drift. |
| 3 | Postgres enum FOLLOW across 2 connections | PASS | PrismaClient #1 creates `Notification` with `kind='FOLLOW'`. PrismaClient #2 (fresh, separate connection pool) reads back row → `kind === 'FOLLOW'` string literal (NOT NULL, exact equality with `NotificationKind.FOLLOW`). Enum equality confirmed. |
| 4 | Cron sweep 5x idempotency drift ≤3 | PASS | `cronAggregatorSweep()` primer run → `N_before` → 5 back-to-back runs → `N_after`. `|N_after - N_before| = 0` (0 drift, well within bound of ≤3). ON CONFLICT upsert dedup keeps repeated sweeps stable. |
| 5 | Quiet hours overnight mocked UTC skip | PASS | `jest.useFakeTimers().setSystemTime` → UTC `03:30` → `isInsideQuietHours('03:30', '22:00', '08:00')` returns `true` (skip). UTC `14:00` → returns `false` (ALLOW). Boundary checks at 22:00, 08:00, 21:59, 08:01 all pass. |

Total: **5/5 PASS Grade A+**.

## Jest Exit 0 Proof (tail)

```
Test Suites: 5 passed, 5 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        5.395 s, estimated 7 s
Ran all test suites matching __tests__/integrity.
==== INTEGRITY_JEST_EXIT=0 ====
```
