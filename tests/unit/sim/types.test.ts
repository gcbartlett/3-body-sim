import { describe, expect, it } from "vitest";
import { isLockMode } from "~/src/sim/types";

describe("isLockMode", () => {
  it('returns true only for "none", "origin", and "com"', () => {
    expect(isLockMode("none")).toBe(true);
    expect(isLockMode("origin")).toBe(true);
    expect(isLockMode("com")).toBe(true);
    expect(isLockMode("manual")).toBe(false);
    expect(isLockMode("")).toBe(false);
  });

  it("returns false for case variants and whitespace-padded strings", () => {
    expect(isLockMode("None")).toBe(false);
    expect(isLockMode("ORIGIN")).toBe(false);
    expect(isLockMode(" Com ")).toBe(false);
    expect(isLockMode("none ")).toBe(false);
    expect(isLockMode(" origin")).toBe(false);
  });

  it("returns false for non-string inputs", () => {
    expect(isLockMode(null)).toBe(false);
    expect(isLockMode(undefined)).toBe(false);
    expect(isLockMode(0)).toBe(false);
    expect(isLockMode(true)).toBe(false);
    expect(isLockMode({ value: "none" })).toBe(false);
    expect(isLockMode(["none"])).toBe(false);
  });
});
