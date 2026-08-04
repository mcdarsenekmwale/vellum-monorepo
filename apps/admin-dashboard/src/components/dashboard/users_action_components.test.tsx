import type { ReactNode } from "react";
import { render, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoleBadge, RoleSelect, PermissionEditor, useRoleOptions } from "./users_action_components";
import type { RbacRole } from "@/lib/api/services";

type MockSelectProps = {
  children?: ReactNode;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  value?: string;
  placeholder?: string;
};

// ─── Test Data ────────────────────────────────────────────────────────────

const createMockRole = (
  overrides: Partial<RbacRole> & { key: string; name: string },
): RbacRole => ({
  id: overrides.id ?? `role-${overrides.key.toLowerCase()}`,
  description: null,
  isSystem: false,
  isActive: true,
  rank: 0,
  ...overrides,
});

const mockRoles: RbacRole[] = [
  createMockRole({
    key: "USER",
    name: "User",
    description: "Regular user",
    isSystem: true,
    rank: 1,
  }),
  createMockRole({
    key: "MODERATOR",
    name: "Moderator",
    description: "Content moderator",
    isSystem: true,
    rank: 3,
  }),
  createMockRole({
    key: "CREATOR",
    name: "Creator",
    description: "Content creator",
    isSystem: false,
    rank: 2,
  }),
  createMockRole({
    key: "ADMIN",
    name: "Admin",
    description: "Administrator",
    isSystem: true,
    rank: 5,
  }),
];

// ─── Mock hooks for component tests ────────────────────────────────────────

vi.mock("@/lib/api/hooks", () => ({
  usePermissionGroups: () => ({
    data: [
      {
        id: "1",
        name: "Content Management",
        permissions: [
          { id: "content:view", name: "View Content", description: "Can view content" },
          { id: "content:edit", name: "Edit Content", description: "Can edit content" },
        ],
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useRbacRoles: () => ({
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }),
}));

// ─── Mock shadcn/ui Select (avoids Radix UI / React 19 incompatibility) ────

vi.mock("@/components/ui/select", async () => {
  const { Children, cloneElement, isValidElement } = await import("react");
  return {
    Select: ({ children, onValueChange, disabled, value }: MockSelectProps) => (
      <div data-testid="mock-select" data-value={value} data-disabled={disabled}>
        {Children.map(children, (child) =>
          isValidElement(child)
            ? cloneElement(child as React.ReactElement<any>, {
                onValueChange,
                disabled,
              } as Record<string, unknown>)
            : child,
        )}
      </div>
    ),
    SelectTrigger: ({ children, disabled, ...props }: MockSelectProps) => (
      <div role="combobox" aria-disabled={disabled || undefined} {...props}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: MockSelectProps) => <span>{placeholder}</span>,
    SelectContent: ({ children }: MockSelectProps) => <div>{children}</div>,
    SelectItem: ({ children, value }: MockSelectProps) => <div data-value={value}>{children}</div>,
    SelectGroup: ({ children }: MockSelectProps) => <div>{children}</div>,
    SelectLabel: ({ children }: MockSelectProps) => <div>{children}</div>,
    SelectSeparator: () => <hr />,
  };
});

// ─── useRoleOptions Hook ──────────────────────────────────────────────────

describe("useRoleOptions", () => {
  it("should return options from provided roles", () => {
    const { result } = renderHook(() => useRoleOptions(mockRoles));
    const customOptions = result.current.options.filter((o) => o.id?.startsWith("role-"));
    expect(customOptions.length).toBeGreaterThanOrEqual(4);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.hasDynamicData).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it("should return static fallback when provided roles are empty", () => {
    const { result } = renderHook(() => useRoleOptions([]));
    expect(result.current.options.length).toBeGreaterThan(0);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.hasDynamicData).toBe(false);
  });

  it("should map roles correctly to options with all properties", () => {
    const { result } = renderHook(() => useRoleOptions(mockRoles));
    const customOptions = result.current.options.filter((o) => o.id?.startsWith("role-"));
    const userOption = customOptions.find((o) => o.key === "USER");
    const adminOption = customOptions.find((o) => o.key === "ADMIN");
    expect(userOption?.key).toBe("USER");
    expect(userOption?.name).toBe("User");
    expect(userOption?.isSystem).toBe(true);
    expect(adminOption?.key).toBe("ADMIN");
    expect(adminOption?.name).toBe("Admin");
  });

  it("should return consistent results across multiple calls", () => {
    const { result: result1 } = renderHook(() => useRoleOptions(mockRoles));
    const { result: result2 } = renderHook(() => useRoleOptions(mockRoles));
    expect(result1.current.options).toEqual(result2.current.options);
  });

  it("should have correct loading and error flags when roles are provided", () => {
    const { result } = renderHook(() => useRoleOptions(mockRoles));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });
});

// ─── RoleBadge Component ──────────────────────────────────────────────────

describe("RoleBadge", () => {
  it("should render with a known system role USER", () => {
    const { container } = render(<RoleBadge role="USER" />);
    expect(container.textContent).toContain("User");
  });

  it("should render with a known system role ADMIN", () => {
    const { container } = render(<RoleBadge role="ADMIN" />);
    expect(container.textContent).toContain("Admin");
  });

  it("should render with a known system role MODERATOR", () => {
    const { container } = render(<RoleBadge role="MODERATOR" />);
    expect(container.textContent).toContain("Moderator");
  });

  it("should render with a known system role CREATOR", () => {
    const { container } = render(<RoleBadge role="CREATOR" />);
    expect(container.textContent).toContain("Creator");
  });

  it("should render custom role from provided roles array", () => {
    const customRoles: RbacRole[] = [createMockRole({ key: "CUSTOM", name: "Custom Role" })];
    const { container } = render(<RoleBadge role="CUSTOM" roles={customRoles} />);
    expect(container.textContent).toContain("Custom Role");
  });

  it("should render unknown roles as the default USER display", () => {
    const { container } = render(<RoleBadge role="UNKNOWN_ROLE" />);
    expect(container.textContent).toContain("User");
  });

  it("should render a badge element with proper structure", () => {
    const { container } = render(<RoleBadge role="ADMIN" />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it("should prefer roles prop over static options when both match", () => {
    const customRoles: RbacRole[] = [createMockRole({ key: "ADMIN", name: "Custom Admin" })];
    const { container } = render(<RoleBadge role="ADMIN" roles={customRoles} />);
    expect(container.textContent).toContain("Custom Admin");
  });

  it("should handle lowercase role keys by normalizing them", () => {
    const { container } = render(<RoleBadge role="admin" />);
    expect(container.textContent).toContain("Admin");
  });
});

// ─── RoleSelect Component ─────────────────────────────────────────────────

describe("RoleSelect", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render a select element when roles are provided", () => {
    const { container } = render(
      <RoleSelect value="USER" onValueChange={onChange} roles={mockRoles} />,
    );
    expect(container.querySelector("[role='combobox']")).toBeTruthy();
  });

  it("should be disabled when disabled prop is true", () => {
    const { container } = render(
      <RoleSelect value="USER" onValueChange={onChange} roles={mockRoles} disabled={true} />,
    );
    const select = container.querySelector("[role='combobox']");
    expect(select).toBeTruthy();
    expect(select).toHaveAttribute("aria-disabled", "true");
  });
});

// ─── PermissionEditor Component ────────────────────────────────────────────

describe("PermissionEditor", () => {
  const onPermissionsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render collapsed by default with an edit permissions button", () => {
    const { container } = render(
      <PermissionEditor selectedPermissions={[]} onPermissionsChange={onPermissionsChange} />,
    );
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button?.textContent?.toLowerCase()).toContain("edit");
  });

  it("should show the count of selected permissions", () => {
    const { container } = render(
      <PermissionEditor
        selectedPermissions={["content:view", "content:edit"]}
        onPermissionsChange={onPermissionsChange}
      />,
    );
    expect(container.textContent).toContain("2");
  });

  it("should be disabled when disabled prop is true", () => {
    const { container } = render(
      <PermissionEditor
        selectedPermissions={[]}
        onPermissionsChange={onPermissionsChange}
        disabled={true}
      />,
    );
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    expect(button).toBeDisabled();
  });
});

// ─── Integration Tests ─────────────────────────────────────────────────────

describe("Role and Permission integration", () => {
  it("useRoleOptions should return options that RoleBadge can display correctly", () => {
    const { result } = renderHook(() => useRoleOptions(mockRoles));

    result.current.options.forEach((option) => {
      const { container } = render(<RoleBadge role={option.key} roles={mockRoles} />);
      expect(container.textContent).toContain(option.name);
    });
  });

  it("RoleSelect and RoleBadge can coexist with the same role data", () => {
    const { container } = render(
      <div>
        <RoleSelect value="ADMIN" onValueChange={() => {}} roles={mockRoles} />
        <RoleBadge role="ADMIN" />
      </div>,
    );
    expect(container.querySelector("[role='combobox']")).toBeTruthy();
    expect(container.textContent).toContain("Admin");
  });
});
