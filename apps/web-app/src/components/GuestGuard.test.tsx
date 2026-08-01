import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuestGuard } from "./GuestGuard";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual as any,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

describe("GuestGuard", () => {
  it("renders children when user is authenticated", () => {
    render(
      <GuestGuard user={{ id: "1" }}>
        <div data-testid="protected">Private Content</div>
      </GuestGuard>,
    );
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("hides content for guests in hide mode", () => {
    render(
      <GuestGuard user={null} mode="hide">
        <div data-testid="protected">Private Content</div>
      </GuestGuard>,
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("shows fallback for guests in hide mode when provided", () => {
    render(
      <GuestGuard user={null} mode="hide" fallback={<div data-testid="fallback">Please log in</div>}>
        <div data-testid="protected">Private Content</div>
      </GuestGuard>,
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("disables content for guests in disable mode", () => {
    render(
      <GuestGuard user={null} mode="disable">
        <button data-testid="btn">Click me</button>
      </GuestGuard>,
    );
    const btn = screen.getByTestId("btn");
    expect(btn).toBeInTheDocument();
    const wrapper = btn.parentElement;
    expect(wrapper).toHaveClass("pointer-events-none");
    expect(wrapper).toHaveClass("opacity-50");
    expect(wrapper).toHaveAttribute("aria-disabled", "true");
  });

  it("shows login prompt for guests in prompt mode", () => {
    render(
      <GuestGuard user={null} mode="prompt" promptMessage="Sign in to comment">
        <div data-testid="protected">Comment form</div>
      </GuestGuard>,
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByText("Sign in to comment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("uses default prompt message when not provided", () => {
    render(
      <GuestGuard user={null} mode="prompt">
        <div>Content</div>
      </GuestGuard>,
    );
    expect(screen.getByText("Sign in to continue")).toBeInTheDocument();
  });

  it("always renders children for authenticated users regardless of mode", () => {
    const { rerender } = render(
      <GuestGuard user={{ id: "1" }} mode="hide">
        <div data-testid="content">Content</div>
      </GuestGuard>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();

    rerender(
      <GuestGuard user={{ id: "1" }} mode="disable">
        <div data-testid="content">Content</div>
      </GuestGuard>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();

    rerender(
      <GuestGuard user={{ id: "1" }} mode="prompt">
        <div data-testid="content">Content</div>
      </GuestGuard>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("applies custom className in disable mode", () => {
    render(
      <GuestGuard user={null} mode="disable" className="custom-class">
        <button>Click</button>
      </GuestGuard>,
    );
    expect(screen.getByText("Click").parentElement).toHaveClass("custom-class");
  });
});
