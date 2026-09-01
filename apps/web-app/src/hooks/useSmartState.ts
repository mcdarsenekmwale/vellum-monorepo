import { useMemo } from "react";

export type SmartStateType = "loading" | "shimmer" | "empty" | "error" | "success";

export interface UseSmartStateOptions {
  isLoading: boolean;
  isError: boolean;
  error?: Error | string | null;
  data?: unknown;
  /**
   * Whether to use shimmer instead of spinner for loading state.
   * Recommended for content-heavy sections (cards, tables, charts).
   */
  useShimmer?: boolean;
  /**
   * Custom predicate to determine if data is empty.
   * Default: checks for null, undefined, empty array, or empty object.
   */
  isEmpty?: (data: unknown) => boolean;
  /**
   * Minimum loading duration in ms before showing loading state.
   * Prevents flicker for fast loads. Default: 0
   */
  minLoadingDelay?: number;
}

export interface SmartStateResult {
  state: SmartStateType;
  error: Error | null;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
}

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data).length === 0;
  return false;
}

/**
 * Determines the appropriate UI state (loading, shimmer, empty, error, success)
 * based on query/mutation state. Prevents flickering and provides consistent
 * state transitions.
 */
export function useSmartState(options: UseSmartStateOptions): SmartStateResult {
  const {
    isLoading,
    isError,
    error = null,
    data,
    useShimmer = false,
    isEmpty: isEmptyFn = defaultIsEmpty,
  } = options;

  return useMemo(() => {
    if (isError) {
      return {
        state: "error",
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        isEmpty: false,
        isError: true,
      };
    }

    if (isLoading) {
      return {
        state: useShimmer ? "shimmer" : "loading",
        error: null,
        isLoading: true,
        isEmpty: false,
        isError: false,
      };
    }

    const empty = isEmptyFn(data);
    if (empty) {
      return {
        state: "empty",
        error: null,
        isLoading: false,
        isEmpty: true,
        isError: false,
      };
    }

    return {
      state: "success",
      error: null,
      isLoading: false,
      isEmpty: false,
      isError: false,
    };
  }, [isLoading, isError, error, data, useShimmer, isEmptyFn]);
}
