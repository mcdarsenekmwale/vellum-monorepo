import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartState } from "./SmartState";

// ─── Mock useI18n hook with stub translations matching test assertions ───
const SMART_STATE_STUB: Record<string, string> = {
  "common.loading": "Loading...",
  "emptyStates.nothingHere": "Nothing here yet",
  "emptyStates.pleaseTryAgain": "Please try again in a moment.",
  "errors.generic": "Something went wrong",
};

vi.mock("@/components/providers/I18nProvider", async () => {
  const actual: unknown = await vi.importActual("@/components/providers/I18nProvider");
  const stubT = (k: string, _args?: Record<string, string | number>) =>
    SMART_STATE_STUB[k] ?? k;
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({
      locale: "en" as const,
      setLocale: vi.fn(),
      t: stubT,
      tArray: (k: string) => stubT(k).split(",").map((s) => s.trim()),
      getLocaleName: (_l: string) => "English",
      supportedLocales: ["en" as const],
      isRTL: false,
      formatNumber: (n: number) => String(n),
      formatDate: (d: Date) => d.toLocaleString(),
    }),
    useTranslate: () => stubT,
    useLocale: () => "en" as const,
    useSetLocale: () => vi.fn(),
    useRTL: () => false,
    useFormatNumber: () => (n: number) => String(n),
    useFormatDate: () => (d: Date) => d.toLocaleString(),
  };
});

describe("SmartState", () => {
  it("renders children in success state", () => {
    render(
      <SmartState isLoading={false} isError={false} data={[1]}>
        <div data-testid="content">Loaded</div>
      </SmartState>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders loading spinner when loading", () => {
    render(
      <SmartState isLoading={true} isError={false}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders shimmer component when useShimmer is true", () => {
    render(
      <SmartState isLoading={true} isError={false} useShimmer shimmerComponent={<div data-testid="shimmer">Shimmer</div>}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByTestId("shimmer")).toBeInTheDocument();
  });

  it("renders empty state when data is empty", () => {
    render(
      <SmartState isLoading={false} isError={false} data={[]}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders custom empty state", () => {
    render(
      <SmartState isLoading={false} isError={false} data={[]} emptyComponent={<div data-testid="custom-empty">Custom</div>}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const onRetry = vi.fn();
    render(
      <SmartState isLoading={false} isError={true} error={new Error("boom")} onRetry={onRetry}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(
      <SmartState isLoading={false} isError={true} error={new Error("boom")} onRetry={onRetry}>
        <div>Content</div>
      </SmartState>,
    );
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders custom error component", () => {
    render(
      <SmartState isLoading={false} isError={true} error={new Error("boom")} errorComponent={<div data-testid="custom-error">Custom Error</div>}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByTestId("custom-error")).toBeInTheDocument();
  });

  it("uses custom empty title and description", () => {
    render(
      <SmartState isLoading={false} isError={false} data={[]} emptyTitle="No items" emptyDescription="Add something">
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Add something")).toBeInTheDocument();
  });

  it("shows default error message when error has no message", () => {
    render(
      <SmartState isLoading={false} isError={true} error={new Error("")}>
        <div>Content</div>
      </SmartState>,
    );
    expect(screen.getByText("Please try again in a moment.")).toBeInTheDocument();
  });
});
