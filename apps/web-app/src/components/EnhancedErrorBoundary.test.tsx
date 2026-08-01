import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnhancedErrorBoundary } from "./EnhancedErrorBoundary";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual as any,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="content">Normal content</div>;
};

describe("EnhancedErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <EnhancedErrorBoundary>
        <div data-testid="content">Normal content</div>
      </EnhancedErrorBoundary>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders error fallback UI when child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <EnhancedErrorBoundary fallback={<div data-testid="custom-fallback">Custom error</div>}>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <EnhancedErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    spy.mockRestore();
  });

  it("recovers when retry is clicked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    rerender(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={false} />
      </EnhancedErrorBoundary>,
    );

    const retryBtn = screen.getByRole("button", { name: /try again/i });
    await userEvent.click(retryBtn);

    expect(screen.getByTestId("content")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("shows default message when error has no message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ThrowNoMessage = () => {
      throw new Error("");
    };
    render(
      <EnhancedErrorBoundary>
        <ThrowNoMessage />
      </EnhancedErrorBoundary>,
    );
    expect(screen.getByText("An unexpected error occurred. Please try again or go back home.")).toBeInTheDocument();
    spy.mockRestore();
  });
});
