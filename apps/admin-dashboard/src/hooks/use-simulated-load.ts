import { useCallback, useEffect, useState } from "react";

/**
 * Simulates an async fetch lifecycle for mock-backed pages so they render
 * proper loading skeletons and support retry. No real network call happens.
 */
export function useSimulatedLoad(delay = 380) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, [delay, tick]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { loading, error, retry };
}
