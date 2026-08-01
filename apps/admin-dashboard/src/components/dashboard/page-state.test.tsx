import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageState, usePageState } from "./page-state";
import { renderHook } from "@testing-library/react";

describe("usePageState", () => {
  it("returns error state when isError is true", () => {
    const { result } = renderHook(() =>
      usePageState({ isLoading: false, isError: true, error: new Error("fail") }),
    );
    expect(result.current.state).toBe("error");
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("fail");
  });

  it("returns error when error object is present even if isError is false", () => {
    const { result } = renderHook(() =>
      usePageState({ isLoading: false, isError: false, error: new Error("fail") }),
    );
    expect(result.current.state).toBe("error");
  });

  it("returns loading state", () => {
    const { result } = renderHook(() => usePageState({ isLoading: true }));
    expect(result.current.state).toBe("loading");
    expect(result.current.isLoading).toBe(true);
  });

  it("returns shimmer state", () => {
    const { result } = renderHook(() => usePageState({ isLoading: true, useShimmer: true }));
    expect(result.current.state).toBe("shimmer");
  });

  it("returns empty state for null data", () => {
    const { result } = renderHook(() => usePageState({ data: null }));
    expect(result.current.state).toBe("empty");
  });

  it("returns empty state for empty array", () => {
    const { result } = renderHook(() => usePageState({ data: [] }));
    expect(result.current.state).toBe("empty");
  });

  it("returns success state for non-empty data", () => {
    const { result } = renderHook(() => usePageState({ data: [1, 2] }));
    expect(result.current.state).toBe("success");
  });

  it("prioritizes error over loading", () => {
    const { result } = renderHook(() =>
      usePageState({ isLoading: true, isError: true, error: new Error("boom") }),
    );
    expect(result.current.state).toBe("error");
  });

  it("handles string errors", () => {
    const { result } = renderHook(() => usePageState({ error: "string error" }));
    expect(result.current.error?.message).toBe("string error");
  });

  it("uses custom isEmpty predicate", () => {
    const { result } = renderHook(() =>
      usePageState({ data: { items: [] }, isEmpty: (d) => (d as any).items.length === 0 }),
    );
    expect(result.current.state).toBe("empty");
  });
});

describe("PageState", () => {
  it("renders children in success state", () => {
    render(
      <PageState data={[1]}>
        <div data-testid="content">Loaded</div>
      </PageState>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(
      <PageState isLoading={true}>
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders shimmer component", () => {
    render(
      <PageState isLoading={true} useShimmer shimmerComponent={<div data-testid="shimmer">Shimmer</div>}>
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByTestId("shimmer")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <PageState data={[]}>
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByText("Nothing to show yet")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters or check back later.")).toBeInTheDocument();
  });

  it("renders custom empty state", () => {
    render(
      <PageState data={[]} emptyComponent={<div data-testid="custom-empty">Custom</div>}>
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });

  it("renders error state with retry", () => {
    const onRetry = vi.fn();
    render(
      <PageState isError={true} error={new Error("boom")} onRetry={onRetry}>
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByText("Couldn't load data")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls onRetry when clicked", async () => {
    const onRetry = vi.fn();
    render(
      <PageState isError={true} error={new Error("boom")} onRetry={onRetry}>
        <div>Content</div>
      </PageState>,
    );
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses custom empty title and description", () => {
    render(
      <PageState data={[]} emptyTitle="No reports" emptyDescription="All caught up">
        <div>Content</div>
      </PageState>,
    );
    expect(screen.getByText("No reports")).toBeInTheDocument();
    expect(screen.getByText("All caught up")).toBeInTheDocument();
  });

  it("applies minHeight class", () => {
    const { container } = render(
      <PageState isLoading={true} minHeight="min-h-[400px]">
        <div>Content</div>
      </PageState>,
    );
    expect(container.firstChild).toHaveClass("min-h-[400px]");
  });
});
