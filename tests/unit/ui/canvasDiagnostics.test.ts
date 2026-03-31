import { describe, expect, it } from "vitest";
import { diagnosticsVisibleHeightForLayout } from "~/src/ui/CanvasDiagnostics";

describe("diagnosticsVisibleHeightForLayout", () => {
  it("keeps closed diagnostics summary height in layout inset", () => {
    expect(diagnosticsVisibleHeightForLayout(24)).toBe(34);
  });

  it("clamps negative measurements to zero", () => {
    expect(diagnosticsVisibleHeightForLayout(-100)).toBe(0);
  });
});
