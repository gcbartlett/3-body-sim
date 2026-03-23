import { describe, expect, it } from "vitest";
import {
  MAX_DISPLAY_DECIMALS,
  decimalPlaces,
} from "~/src/ui/controlPanel/numberInputPrecision";

describe("decimalPlaces", () => {
  it("returns 0 for non-finite values", () => {
    expect(decimalPlaces(Number.POSITIVE_INFINITY)).toBe(0);
    expect(decimalPlaces(Number.NaN)).toBe(0);
  });

  it("counts decimal places for regular decimal inputs", () => {
    expect(decimalPlaces(1)).toBe(0);
    expect(decimalPlaces(1.25)).toBe(2);
    expect(decimalPlaces(-0.125)).toBe(3);
  });

  it("handles scientific notation with positive exponents", () => {
    expect(decimalPlaces(1.23e2)).toBe(0);
    expect(decimalPlaces(1.23e1)).toBe(1);
    expect(decimalPlaces(1.23e0)).toBe(2);
  });

  it("handles scientific notation with negative exponents", () => {
    expect(decimalPlaces(1e-3)).toBe(3);
    expect(decimalPlaces(1.2e-4)).toBe(5);
  });

  it("clamps decimal precision to MAX_DISPLAY_DECIMALS", () => {
    expect(decimalPlaces(1e-20)).toBe(MAX_DISPLAY_DECIMALS);
    expect(decimalPlaces(1.234567890123456e-5)).toBe(MAX_DISPLAY_DECIMALS);
  });
});
