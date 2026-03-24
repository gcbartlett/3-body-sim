import { describe, expect, it } from "vitest";
import { formatDiagnosticValue } from "~/src/sim/diagnosticFormatting";

describe("formatDiagnosticValue", () => {
  it("normalizes very small magnitudes to signed zero format", () => {
    expect(formatDiagnosticValue(0.00049)).toBe("+0.00");
    expect(formatDiagnosticValue(-0.00049)).toBe("+0.00");
  });

  it("switches decimal precision by magnitude bands", () => {
    expect(formatDiagnosticValue(123.4)).toBe("+123");
    expect(formatDiagnosticValue(12.34)).toBe("+12.3");
    expect(formatDiagnosticValue(1.234)).toBe("+1.23");
  });

  it("adds '+' for positives and omits it for negatives", () => {
    expect(formatDiagnosticValue(2.5)).toBe("+2.50");
    expect(formatDiagnosticValue(-2.5)).toBe("-2.50");
  });

  it("rounds boundary values deterministically", () => {
    expect(formatDiagnosticValue(99.94)).toBe("+99.9");
    expect(formatDiagnosticValue(99.95)).toBe("+100.0");
  });
});
