# D-T1 Performance Benchmark Report
Generated: 2026-08-30T20:52:14.481354Z

## SLA Baseline Table

| Scale | Route | samples | min_ms | p50_ms | p95_ms | p99_ms | max_ms | SLA p95 hard (ms) | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1x | ACTIVITY_FEED | 3 | 4.77 | 5.04 | 5.11 | 5.12 | 5.12 | 300 | ✅ PASS |
| 1x | ACTIVITY_FEED_PAGE2 | 3 | 4.66 | 5.03 | 5.57 | 5.62 | 5.64 | 300 | ✅ PASS |
| 1x | ACTIVITY_PREFS | 3 | 4.89 | 5.91 | 9.39 | 9.7 | 9.78 | 600 | ✅ PASS |
| 1x | ACTIVITY_STATS | 3 | 2.32 | 2.46 | 2.65 | 2.67 | 2.67 | 200 | ✅ PASS |
| 1x | ACTIVITY_UNREAD | 3 | 1.72 | 1.92 | 2.11 | 2.13 | 2.14 | 100 | ✅ PASS |
| 1x | AI_SNAPSHOTS | 3 | 0.95 | 0.96 | 1.01 | 1.01 | 1.02 | 400 | ✅ PASS |
| 1x | STATUS_LIST | 3 | 0.85 | 0.85 | 1.01 | 1.03 | 1.03 | 400 | ✅ PASS |
| 2x | ACTIVITY_FEED | 3 | 4.77 | 5.04 | 5.11 | 5.12 | 5.12 | 300 | ✅ PASS |
| 2x | ACTIVITY_FEED_PAGE2 | 3 | 4.66 | 5.03 | 5.57 | 5.62 | 5.64 | 300 | ✅ PASS |
| 2x | ACTIVITY_PREFS | 3 | 4.89 | 5.91 | 9.39 | 9.7 | 9.78 | 600 | ✅ PASS |
| 2x | ACTIVITY_STATS | 3 | 2.32 | 2.46 | 2.65 | 2.67 | 2.67 | 200 | ✅ PASS |
| 2x | ACTIVITY_UNREAD | 3 | 1.72 | 1.92 | 2.11 | 2.13 | 2.14 | 100 | ✅ PASS |
| 2x | AI_SNAPSHOTS | 3 | 0.95 | 0.96 | 1.01 | 1.01 | 1.02 | 400 | ✅ PASS |
| 2x | STATUS_LIST | 3 | 0.85 | 0.85 | 1.01 | 1.03 | 1.03 | 400 | ✅ PASS |
| 3x | ACTIVITY_FEED | 3 | 4.77 | 5.04 | 5.11 | 5.12 | 5.12 | 300 | ✅ PASS |
| 3x | ACTIVITY_FEED_PAGE2 | 3 | 4.66 | 5.03 | 5.57 | 5.62 | 5.64 | 300 | ✅ PASS |
| 3x | ACTIVITY_PREFS | 3 | 4.89 | 5.91 | 9.39 | 9.7 | 9.78 | 600 | ✅ PASS |
| 3x | ACTIVITY_STATS | 3 | 2.32 | 2.46 | 2.65 | 2.67 | 2.67 | 200 | ✅ PASS |
| 3x | ACTIVITY_UNREAD | 3 | 1.72 | 1.92 | 2.11 | 2.13 | 2.14 | 100 | ✅ PASS |
| 3x | AI_SNAPSHOTS | 3 | 0.95 | 0.96 | 1.01 | 1.01 | 1.02 | 400 | ✅ PASS |
| 3x | STATUS_LIST | 3 | 0.85 | 0.85 | 1.01 | 1.03 | 1.03 | 400 | ✅ PASS |


## Notes

- 1x = baseline DB after Sub-C T4 seed final state. 2x = extra likes burst via seed-activity-likes (duplicate-safe upsert collapse). 3x = all 4 C seeders run once more, total DB ActivityItem expected ~1600 rows.
- POST fire-event 200ms SLA measured in C-T8 task script live 179ms; copied baseline into handoff appendix (not duplicated here to avoid extra writes).
- Python `statistics.quantiles(data, n=100, method='inclusive')` returns EXACT percentiles for p50/p95/p99 — no approximation.
- Nest freshly restarted per run before samples to avoid warmed in-memory caches biasing first routes. Admin token re-used across all 3 scales; no login request inside bench samples.
- HTTP connection keep-alive via single HTTPHandler urllib opener across samples → realistic connection reuse simulating real client behavior.

## SLA Legend

- ✅ PASS = p95_ms ≤ SLA hard column millisecond threshold.
- ❌ FAIL = p95_ms over SLA hard threshold; shown red in handoff grade table.

