import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadOnlyBanner } from "./read-only-banner";

describe("ReadOnlyBanner", () => {
  it("renders banner variant by default", () => {
    render(<ReadOnlyBanner resource="articles" />);
    expect(screen.getByText("Read-only mode")).toBeInTheDocument();
    expect(screen.getByText(/You can view articles/i)).toBeInTheDocument();
  });

  it("renders inline variant", () => {
    render(<ReadOnlyBanner resource="users" variant="inline" />);
    expect(screen.getByText(/Read-only: you can view but not modify users/i)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<ReadOnlyBanner resource="articles" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });

  it("displays correct resource name in banner", () => {
    render(<ReadOnlyBanner resource="moderation queue" />);
    expect(screen.getByText(/You can view moderation queue/i)).toBeInTheDocument();
  });

  it("displays correct resource name in inline", () => {
    render(<ReadOnlyBanner resource="settings" variant="inline" />);
    expect(screen.getByText(/Read-only: you can view but not modify settings/i)).toBeInTheDocument();
  });
});
