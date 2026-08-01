import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "./usePermission";

describe("usePermission", () => {
  it("identifies guest when user is null", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.isGuest).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("identifies guest when user is undefined", () => {
    const { result } = renderHook(() => usePermission(undefined));
    expect(result.current.isGuest).toBe(true);
  });

  it("identifies authenticated when user exists", () => {
    const { result } = renderHook(() => usePermission({ id: "1" }));
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("allows guests to read articles", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.can("read:articles")).toBe(true);
  });

  it("denies guests write permissions", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.can("write:articles")).toBe(false);
    expect(result.current.can("write:comments")).toBe(false);
    expect(result.current.can("like:content")).toBe(false);
    expect(result.current.can("save:content")).toBe(false);
    expect(result.current.can("follow:users")).toBe(false);
  });

  it("allows authenticated users all permissions", () => {
    const { result } = renderHook(() => usePermission({ id: "1" }));
    expect(result.current.can("read:articles")).toBe(true);
    expect(result.current.can("write:articles")).toBe(true);
    expect(result.current.can("write:comments")).toBe(true);
    expect(result.current.can("like:content")).toBe(true);
    expect(result.current.can("save:content")).toBe(true);
    expect(result.current.can("follow:users")).toBe(true);
    expect(result.current.can("compose:content")).toBe(true);
  });

  it("denies guests settings access", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.can("read:settings")).toBe(false);
    expect(result.current.can("write:settings")).toBe(false);
  });

  it("allows authenticated users to share content", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.can("share:content")).toBe(true);
  });

  it("returns false for unknown permissions", () => {
    const { result } = renderHook(() => usePermission({ id: "1" }));
    expect(result.current.can("unknown:permission" as any)).toBe(false);
  });

  it("canRead falls back to read variant", () => {
    const { result } = renderHook(() => usePermission(null));
    expect(result.current.canRead("write:articles")).toBe(true);
  });
});
