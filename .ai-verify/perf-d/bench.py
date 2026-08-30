#!/usr/bin/env python3
"""bench.py: HTTP keep-alive performance harness.
Usage: python bench.py <url> [samples=5] [warmup=1]
  env: TOKEN=<Bearer> if needed
Output JSON to stdout: {min_ms, p50_ms, p95_ms, p99_ms, max_ms, samples[]}
"""
import sys, os, json, urllib.request, urllib.error, statistics, time

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error":"url required"}), file=sys.stderr); sys.exit(2)
    url = sys.argv[1]
    samples = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    warmup = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    token = os.environ.get('TOKEN', '')
    times_ms = []
    handler = urllib.request.HTTPSHandler() if url.startswith('https') else urllib.request.HTTPHandler()
    opener = urllib.request.build_opener(handler)
    for i in range(warmup + samples):
        req = urllib.request.Request(url)
        if token:
            req.add_header('Authorization', f'Bearer {token}')
        t0 = time.perf_counter()
        try:
            with opener.open(req, timeout=30) as r:
                r.read()
        except urllib.error.HTTPError as e:
            _ = e.read()
        except Exception as e:
            pass  # ignore network transient on warmup
        ms = (time.perf_counter() - t0) * 1000
        if i >= warmup:
            times_ms.append(ms)
    if len(times_ms) == 0:
        out = {"error":"no samples"}
    else:
        srt = sorted(times_ms)
        if len(srt) >= 2:
            q = statistics.quantiles(srt, n=100, method='inclusive')
            def pct(p):
                idx = min(len(q)-1, max(0, p-1))
                return q[idx]
            p50 = pct(50); p95 = pct(95); p99 = pct(99)
        else:
            p50 = srt[0]; p95 = srt[0]; p99 = srt[0]
        out = {
            "samples": len(times_ms),
            "min_ms": round(min(times_ms), 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "p99_ms": round(p99, 2),
            "max_ms": round(max(times_ms), 2),
            "raw_ms": [round(x,2) for x in times_ms],
        }
    print(json.dumps(out, indent=2))

if __name__ == '__main__':
    main()
