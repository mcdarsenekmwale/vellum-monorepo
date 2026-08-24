import { describe, it, expect } from "vitest";
import {
  can,
  canRead,
  canWrite,
  roleRank,
  roleAtLeast,
  requiredRoleFor,
  canVisit,
  getPermissions,
  type Role,
} from "./rbac";

describe("RBAC", () => {
  describe("roleRank", () => {
    it("returns correct rank for each role", () => {
      // Matches the RANK table in ./rbac.ts. NOTE: SupportAgent and
      // SupportAdmin sit between Editor and Admin so help-desk staff can own
      // tickets without receiving role-management admin powers.
      expect(roleRank("Guest")).toBe(0);
      expect(roleRank("User")).toBe(1);
      expect(roleRank("Creator")).toBe(2);
      expect(roleRank("Moderator")).toBe(3);
      expect(roleRank("Editor")).toBe(4);
      expect(roleRank("SupportAgent")).toBe(5);
      expect(roleRank("SupportAdmin")).toBe(6);
      expect(roleRank("Admin")).toBe(7);
      expect(roleRank("SuperAdmin")).toBe(8);
    });

    it("returns 0 for unknown role", () => {
      expect(roleRank("Unknown" as Role)).toBe(0);
    });
  });

  describe("roleAtLeast", () => {
    it("returns false for undefined role", () => {
      expect(roleAtLeast(undefined, "User")).toBe(false);
    });

    it("returns true when role meets minimum", () => {
      expect(roleAtLeast("Admin", "Moderator")).toBe(true);
      expect(roleAtLeast("Moderator", "Moderator")).toBe(true);
    });

    it("returns false when role is below minimum", () => {
      expect(roleAtLeast("User", "Moderator")).toBe(false);
      expect(roleAtLeast("Guest", "User")).toBe(false);
    });
  });

  describe("can", () => {
    it("returns false for undefined role", () => {
      expect(can(undefined, "articles", "read")).toBe(false);
    });

    it("allows Guest to read public content", () => {
      expect(can("Guest", "articles", "read")).toBe(true);
      expect(can("Guest", "posts", "read")).toBe(true);
      expect(can("Guest", "comments", "read")).toBe(true);
      expect(can("Guest", "highlights", "read")).toBe(true);
    });

    it("denies Guest write access", () => {
      expect(can("Guest", "articles", "write")).toBe(false);
      expect(can("Guest", "comments", "write")).toBe(false);
    });

    it("allows Moderator to read users", () => {
      expect(can("Moderator", "users", "read")).toBe(true);
    });

    it("denies Moderator from deleting users", () => {
      expect(can("Moderator", "users", "delete")).toBe(false);
    });

    it("allows Admin full user management", () => {
      expect(can("Admin", "users", "read")).toBe(true);
      expect(can("Admin", "users", "write")).toBe(true);
      expect(can("Admin", "users", "delete")).toBe(true);
    });

    it("denies access to unknown resource/action", () => {
      expect(can("SuperAdmin", "unknown" as any, "read")).toBe(false);
    });

    it("allows SuperAdmin everything", () => {
      expect(can("SuperAdmin", "roles", "write")).toBe(true);
      expect(can("SuperAdmin", "audit", "write")).toBe(true);
      expect(can("SuperAdmin", "billing", "delete")).toBe(true);
    });
  });

  describe("canRead / canWrite", () => {
    it("canRead delegates to can with read action", () => {
      expect(canRead("Guest", "articles")).toBe(true);
      expect(canRead("Guest", "users")).toBe(false);
    });

    it("canWrite delegates to can with write action", () => {
      expect(canWrite("Guest", "articles")).toBe(false);
      expect(canWrite("Creator", "articles")).toBe(true);
    });
  });

  describe("requiredRoleFor", () => {
    it("returns correct minimum role for paths", () => {
      expect(requiredRoleFor("/dashboard")).toBe("User");
      expect(requiredRoleFor("/users")).toBe("Moderator");
      expect(requiredRoleFor("/articles")).toBe("Guest");
      expect(requiredRoleFor("/settings")).toBe("Admin");
    });

    it("matches nested paths", () => {
      expect(requiredRoleFor("/users/123")).toBe("Moderator");
      expect(requiredRoleFor("/articles/edit/123")).toBe("Guest");
    });

    it("defaults to User for unknown paths", () => {
      expect(requiredRoleFor("/unknown")).toBe("User");
    });
  });

  describe("canVisit", () => {
    it("allows Guest to visit public routes", () => {
      expect(canVisit("Guest", "/articles")).toBe(true);
      expect(canVisit("Guest", "/posts")).toBe(true);
    });

    it("denies Guest from protected routes", () => {
      expect(canVisit("Guest", "/dashboard")).toBe(false);
      expect(canVisit("Guest", "/users")).toBe(false);
    });

    it("allows Admin to visit admin routes", () => {
      expect(canVisit("Admin", "/settings")).toBe(true);
      expect(canVisit("Admin", "/users")).toBe(true);
    });
  });

  describe("getPermissions", () => {
    it("returns permission map for a role", () => {
      const perms = getPermissions("Guest");
      expect(perms.articles.read).toBe(true);
      expect(perms.articles.write).toBe(false);
      expect(perms.users.read).toBe(false);
    });

    it("returns all false for undefined role", () => {
      const perms = getPermissions(undefined);
      expect(perms.articles.read).toBe(false);
      expect(perms.articles.write).toBe(false);
    });
  });
});
