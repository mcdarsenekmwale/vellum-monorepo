import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { PermissionGuard, PermissionGate } from "./permission-guard";
import type { Role } from "@/lib/auth/rbac";

// Mock auth context to avoid module resolution issues in tests
type MockAuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type MockAuthState = {
  user: MockAuthUser | null;
  isAuthenticated: boolean;
};

const MockAuthContext = createContext<MockAuthState>({
  user: null,
  isAuthenticated: false,
});

// Override useAuth in permission-guard by providing the context
function MockAuthProvider({
  children,
  role,
}: {
  children: ReactNode;
  role?: Role;
}) {
  const user: MockAuthUser | null = role
    ? {
        id: "1",
        name: "Test",
        email: "test@test.com",
        role,
      }
    : null;

  return (
    <MockAuthContext.Provider value={{ user, isAuthenticated: !!user }}>
      {children}
    </MockAuthContext.Provider>
  );
}

// We need to mock the useAuth hook used by permission-guard
// Since we can't easily mock the module, we'll render the components
// inside a wrapper that provides the auth context.
// However, PermissionGuard imports useAuth from @/lib/auth/context.
// For tests to work, we mock that module.

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => useContext(MockAuthContext),
}));

import { vi } from "vitest";

describe("PermissionGuard", () => {
  it("renders children when user has permission", () => {
    render(
      <MockAuthProvider role="Admin">
        <PermissionGuard resource="users" action="read">
          <div data-testid="content">Users List</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders fallback when user lacks permission", () => {
    render(
      <MockAuthProvider role="Guest">
        <PermissionGuard resource="users" action="read" fallback={<div data-testid="fallback">No access</div>}>
          <div data-testid="content">Users List</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("renders null fallback by default when no permission", () => {
    render(
      <MockAuthProvider role="Guest">
        <PermissionGuard resource="users" action="read">
          <div data-testid="content">Users List</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("shows read-only banner when user can read but not write", () => {
    render(
      <MockAuthProvider role="User">
        <PermissionGuard resource="articles" action="read" showReadOnlyBanner>
          <div data-testid="content">Articles</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText(/Read-only mode/i)).toBeInTheDocument();
  });

  it("does not show read-only banner when user can write", () => {
    render(
      <MockAuthProvider role="Admin">
        <PermissionGuard resource="users" action="read" showReadOnlyBanner>
          <div data-testid="content">Users</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByText(/Read-only mode/i)).not.toBeInTheDocument();
  });

  it("does not show read-only banner for write action", () => {
    render(
      <MockAuthProvider role="Creator">
        <PermissionGuard resource="articles" action="write" showReadOnlyBanner>
          <div data-testid="content">Articles</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByText(/Read-only mode/i)).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <MockAuthProvider role="Admin">
        <PermissionGuard resource="users" action="read" className="custom-class">
          <div data-testid="content">Users</div>
        </PermissionGuard>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content").parentElement).toHaveClass("custom-class");
  });
});

describe("PermissionGate", () => {
  it("renders children when allowed", () => {
    render(
      <MockAuthProvider role="Moderator">
        <PermissionGate resource="moderation" action="read">
          <div data-testid="content">Queue</div>
        </PermissionGate>
      </MockAuthProvider>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders fallback when not allowed", () => {
    render(
      <MockAuthProvider role="Guest">
        <PermissionGate resource="moderation" action="read" fallback={<div data-testid="fallback">No access</div>}>
          <div data-testid="content">Queue</div>
        </PermissionGate>
      </MockAuthProvider>,
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("renders nothing when not allowed and no fallback", () => {
    render(
      <MockAuthProvider role="Guest">
        <PermissionGate resource="moderation" action="read">
          <div data-testid="content">Queue</div>
        </PermissionGate>
      </MockAuthProvider>,
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });
});
