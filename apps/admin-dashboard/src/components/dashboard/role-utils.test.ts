import { describe, it, expect } from "vitest";
import {
  mapRbacRolesToOptions,
  getRoleDisplayKey,
} from "./users_action_components";
import type { RbacRole } from "@/lib/api/services";

// ─── Test Data ────────────────────────────────────────────────────────────

const createMockRole = (overrides: Partial<RbacRole> & { key: string; name: string }): RbacRole => ({
  id: overrides.id ?? `role-${overrides.key.toLowerCase()}`,
  description: null,
  isSystem: false,
  isActive: true,
  rank: 0,
  ...overrides,
});

const mockRoles: RbacRole[] = [
  createMockRole({ key: "USER", name: "User", description: "Regular user", isSystem: true, rank: 1 }),
  createMockRole({ key: "MODERATOR", name: "Moderator", description: "Content moderator", isSystem: true, rank: 3 }),
  createMockRole({ key: "CREATOR", name: "Creator", description: "Content creator", isSystem: false, rank: 2 }),
  createMockRole({ key: "ADMIN", name: "Admin", description: "Administrator", isSystem: true, rank: 5 }),
];

// ─── mapRbacRolesToOptions ─────────────────────────────────────────────────

describe("mapRbacRolesToOptions", () => {
  it("should convert RbacRole array to RoleOption array with correct fields", () => {
    const result = mapRbacRolesToOptions(mockRoles);
    expect(result.length).toBeGreaterThanOrEqual(4);
    const customRoles = result.filter(r => r.id?.startsWith("role-"));
    expect(customRoles.length).toBeGreaterThanOrEqual(4);
    expect(customRoles[0].key).toBe("USER");
    expect(customRoles[0].name).toBe("User");
    expect(customRoles[0].isSystem).toBe(true);
  });

  it("should return static fallback roles when input is undefined", () => {
    const result = mapRbacRolesToOptions(undefined);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.key === "ADMIN")).toBe(true);
  });

  it("should return static fallback roles when input is empty", () => {
    const result = mapRbacRolesToOptions([]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.key === "ADMIN")).toBe(true);
  });

  it("should filter out inactive roles", () => {
    const rolesWithInactive: RbacRole[] = [
      createMockRole({ key: "ACTIVE", name: "Active Role", isActive: true }),
      createMockRole({ key: "INACTIVE", name: "Inactive Role", isActive: false }),
    ];
    const result = mapRbacRolesToOptions(rolesWithInactive);
    const customRoles = result.filter(r => r.id?.startsWith("role-active") || r.id?.startsWith("role-inactive"));
    expect(customRoles.find(r => r.key === "ACTIVE")).toBeDefined();
    expect(customRoles.find(r => r.key === "INACTIVE")).toBeUndefined();
  });

  it("should sort roles by rank ascending", () => {
    const unsortedRoles: RbacRole[] = [
      createMockRole({ key: "HIGH", name: "High Rank", rank: 10 }),
      createMockRole({ key: "LOW", name: "Low Rank", rank: 1 }),
      createMockRole({ key: "MEDIUM", name: "Medium Rank", rank: 5 }),
    ];
    const result = mapRbacRolesToOptions(unsortedRoles);
    const customRoles = result.filter(r => r.id?.startsWith("role-"));
    expect(customRoles[0].key).toBe("LOW");
    expect(customRoles[1].key).toBe("MEDIUM");
    expect(customRoles[2].key).toBe("HIGH");
  });

  it("should handle roles with null description", () => {
    const nullDescRoles: RbacRole[] = [
      createMockRole({ key: "TEST", name: "Test Role", description: null }),
    ];
    const result = mapRbacRolesToOptions(nullDescRoles);
    const testRole = result.find(r => r.key === "TEST");
    expect(testRole?.description).toBeUndefined();
  });
});

// ─── getRoleDisplayKey ──────────────────────────────────────────────────────

describe("getRoleDisplayKey", () => {
  it("returns exact 8-level Prisma enum keys unchanged when inputs match", () => {
    expect(getRoleDisplayKey("ADMIN")).toBe("ADMIN");
    expect(getRoleDisplayKey("SUPER_ADMIN")).toBe("SUPER_ADMIN");
    expect(getRoleDisplayKey("PLATFORM_ADMIN")).toBe("PLATFORM_ADMIN");
    expect(getRoleDisplayKey("SUPPORT_ADMIN")).toBe("SUPPORT_ADMIN");
    expect(getRoleDisplayKey("MODERATOR")).toBe("MODERATOR");
    expect(getRoleDisplayKey("CREATOR")).toBe("CREATOR");
    expect(getRoleDisplayKey("USER")).toBe("USER");
    expect(getRoleDisplayKey("GUEST")).toBe("GUEST");
  });

  it("returns the matching enum level for case/format variations of known roles", () => {
    // Case-insensitive match → exact enum tier
    expect(getRoleDisplayKey("admin")).toBe("ADMIN");
    expect(getRoleDisplayKey("super_admin")).toBe("SUPER_ADMIN");
    expect(getRoleDisplayKey("SupportAdmin")).toBe("SUPPORT_ADMIN");
    expect(getRoleDisplayKey("platform-admin")).toBe("PLATFORM_ADMIN");
    expect(getRoleDisplayKey("moderator")).toBe("MODERATOR");
    expect(getRoleDisplayKey("creator")).toBe("CREATOR");
    expect(getRoleDisplayKey("user")).toBe("USER");
    expect(getRoleDisplayKey("guest")).toBe("GUEST");
  });

  it("returns semantic ADMIN-level buckets for admin-ish custom keys", () => {
    expect(getRoleDisplayKey("Administrator")).toBe("ADMIN");
    expect(getRoleDisplayKey("Organization Admin")).toBe("PLATFORM_ADMIN");
    expect(getRoleDisplayKey("sysadmin")).toBe("SUPER_ADMIN");
  });

  it("returns MODERATOR for moderator roles", () => {
    expect(getRoleDisplayKey("ContentModerator")).toBe("MODERATOR");
    expect(getRoleDisplayKey("flag_reviewer")).toBe("MODERATOR");
    expect(getRoleDisplayKey("SupportAgent")).toBe("MODERATOR");
  });

  it("returns CREATOR for creator/author/editor roles", () => {
    expect(getRoleDisplayKey("ContentCreator")).toBe("CREATOR");
    expect(getRoleDisplayKey("author")).toBe("CREATOR");
    expect(getRoleDisplayKey("Editor")).toBe("CREATOR");
  });

  it("returns GUEST for guest/anonymous roles", () => {
    expect(getRoleDisplayKey("GuestUser")).toBe("GUEST");
    expect(getRoleDisplayKey("anonymous")).toBe("GUEST");
  });

  it("returns USER for unknown roles as fallback", () => {
    expect(getRoleDisplayKey("custom_role")).toBe("USER");
    expect(getRoleDisplayKey("analyst")).toBe("USER");
    expect(getRoleDisplayKey("marketing_specialist")).toBe("USER");
  });

  it("handles empty string → USER fallback", () => {
    expect(getRoleDisplayKey("")).toBe("USER");
  });
});