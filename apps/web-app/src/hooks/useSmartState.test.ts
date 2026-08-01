import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSmartState } from "./useSmartState";

describe("useSmartState", () => {
  it("returns error state when isError is true", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: true, error: new Error("fail") }),
    );
    expect(result.current.state).toBe("error");
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("fail");
  });

  it("returns loading state when isLoading is true and no error", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: true, isError: false }),
    );
    expect(result.current.state).toBe("loading");
    expect(result.current.isLoading).toBe(true);
  });

  it("returns shimmer state when useShimmer is true and loading", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: true, isError: false, useShimmer: true }),
    );
    expect(result.current.state).toBe("shimmer");
  });

  it("returns empty state for null data", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: false, data: null }),
    );
    expect(result.current.state).toBe("empty");
    expect(result.current.isEmpty).toBe(true);
  });

  it("returns empty state for empty array", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: false, data: [] }),
    );
    expect(result.current.state).toBe("empty");
  });

  it("returns empty state for empty object", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: false, data: {} }),
    );
    expect(result.current.state).toBe("empty");
  });

  it("returns success state for non-empty data", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: false, data: [1, 2, 3] }),
    );
    expect(result.current.state).toBe("success");
    expect(result.current.isEmpty).toBe(false);
  });

  it("prioritizes error over loading", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: true, isError: true, error: new Error("boom") }),
    );
    expect(result.current.state).toBe("error");
  });

  it("uses custom isEmpty predicate", () => {
    const { result } = renderHook(() =>
      useSmartState({
        isLoading: false,
        isError: false,
        data: { items: [] },
        isEmpty: (d) => (d as { items: unknown[] }).items.length === 0,
      }),
    );
    expect(result.current.state).toBe("empty");
  });

  it("handles string error", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: true, error: "string error" }),
    );
    expect(result.current.state).toBe("error");
    expect(result.current.error?.message).toBe("string error");
  });

  it("returns success for non-empty string", () => {
    const { result } = renderHook(() =>
      useSmartState({ isLoading: false, isError: false, data: "hello" }),
    );
    expect(result.current.state).toBe("success");
  });
});
