import { describe, expect, it } from "vitest";
import {
  dissolutionHighlightStyle,
  farCoreRatioHighlightStyle,
  nboundHighlightStyle,
  outwardHighlightStyle,
  pairEnergyHighlightStyle,
  positiveValueHighlightStyle,
  speedRatioHighlightStyle,
} from "~/src/ui/diagnostics/styles";

describe("pairEnergyHighlightStyle", () => {
  it("returns gradient style only for positive energy", () => {
    const style = pairEnergyHighlightStyle(0.1, "#111111", "#222222");
    expect(style).toBeDefined();
    expect(style?.background).toContain("linear-gradient(90deg");
    expect(style?.background).toContain("#111111");
    expect(style?.background).toContain("#222222");
    expect(typeof style?.color).toBe("string");
    expect(pairEnergyHighlightStyle(0, "#111111", "#222222")).toBeUndefined();
    expect(pairEnergyHighlightStyle(-0.1, "#111111", "#222222")).toBeUndefined();
  });
});

describe("nboundHighlightStyle", () => {
  it("highlights only when nbound < 1", () => {
    const style = nboundHighlightStyle(0);
    expect(style).toBeDefined();
    expect(typeof style?.backgroundColor).toBe("string");
    expect(typeof style?.color).toBe("string");
    expect(nboundHighlightStyle(1)).toBeUndefined();
    expect(nboundHighlightStyle(2)).toBeUndefined();
  });
});

describe("dissolutionHighlightStyle", () => {
  it("highlights when dissolution counter is positive or dissolution is detected", () => {
    const fromCounter = dissolutionHighlightStyle(0.01, false);
    expect(fromCounter).toBeDefined();
    expect(typeof fromCounter?.backgroundColor).toBe("string");
    expect(typeof fromCounter?.color).toBe("string");

    const fromDetected = dissolutionHighlightStyle(0, true);
    expect(fromDetected).toBeDefined();
    expect(typeof fromDetected?.backgroundColor).toBe("string");
    expect(typeof fromDetected?.color).toBe("string");

    expect(dissolutionHighlightStyle(0, false)).toBeUndefined();
  });
});

describe("single-gate highlight selectors", () => {
  it("returns highlight styles only when each gate is satisfied", () => {
    const positive = positiveValueHighlightStyle(1, "#abc123");
    expect(positive).toBeDefined();
    expect(positive?.backgroundColor).toBe("#abc123");
    expect(typeof positive?.color).toBe("string");
    expect(positiveValueHighlightStyle(0, "#abc123")).toBeUndefined();

    const speed = speedRatioHighlightStyle(1.01, "#def456");
    expect(speed).toBeDefined();
    expect(speed?.backgroundColor).toBe("#def456");
    expect(typeof speed?.color).toBe("string");
    expect(speedRatioHighlightStyle(1, "#def456")).toBeUndefined();

    const farCore = farCoreRatioHighlightStyle(5.1, 5, "#123abc");
    expect(farCore).toBeDefined();
    expect(farCore?.backgroundColor).toBe("#123abc");
    expect(typeof farCore?.color).toBe("string");
    expect(farCoreRatioHighlightStyle(5, 5, "#123abc")).toBeUndefined();

    const outward = outwardHighlightStyle(true, "#654321");
    expect(outward).toBeDefined();
    expect(outward?.backgroundColor).toBe("#654321");
    expect(typeof outward?.color).toBe("string");
    expect(outwardHighlightStyle(false, "#654321")).toBeUndefined();
  });
});
