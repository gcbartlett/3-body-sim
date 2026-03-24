import { describe, expect, it } from "vitest";
import { add, magnitude, magnitudeSquared, scale, sub } from "~/src/sim/vector";

describe("add", () => {
  it("adds x/y components independently", () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
  });

  it("handles negative and fractional components", () => {
    expect(add({ x: -1.5, y: 2.25 }, { x: 0.5, y: -3.75 })).toEqual({ x: -1, y: -1.5 });
  });
});

describe("sub", () => {
  it("subtracts x/y components independently", () => {
    expect(sub({ x: 5, y: 4 }, { x: 2, y: 1 })).toEqual({ x: 3, y: 3 });
  });

  it("satisfies anti-symmetry: sub(a,b) = scale(sub(b,a), -1)", () => {
    const a = { x: 2.5, y: -7 };
    const b = { x: -3, y: 1.25 };

    expect(sub(a, b)).toEqual(scale(sub(b, a), -1));
  });
});

describe("scale", () => {
  it("multiplies both components by scalar", () => {
    expect(scale({ x: 2, y: -3 }, 1.5)).toEqual({ x: 3, y: -4.5 });
  });

  it("returns zero vector for zero scalar and flips direction for negative scalar", () => {
    const zeroScaled = scale({ x: 2, y: -3 }, 0);

    expect(zeroScaled.x).toBeCloseTo(0, 12);
    expect(zeroScaled.y).toBeCloseTo(0, 12);
    expect(scale({ x: 2, y: -3 }, -2)).toEqual({ x: -4, y: 6 });
  });
});

describe("magnitudeSquared", () => {
  it("returns x^2 + y^2 for fixture vectors", () => {
    expect(magnitudeSquared({ x: 3, y: 4 })).toBe(25);
    expect(magnitudeSquared({ x: -1.5, y: 2 })).toBe(6.25);
  });

  it("is always non-negative", () => {
    expect(magnitudeSquared({ x: -100, y: -200 })).toBeGreaterThanOrEqual(0);
    expect(magnitudeSquared({ x: 0, y: 0 })).toBeGreaterThanOrEqual(0);
  });
});

describe("magnitude", () => {
  it("equals sqrt(magnitudeSquared(v)) for multiple fixtures", () => {
    const fixtures = [
      { x: 3, y: 4 },
      { x: -5, y: 12 },
      { x: 1.5, y: -2.5 },
    ];
    for (const v of fixtures) {
      expect(magnitude(v)).toBeCloseTo(Math.sqrt(magnitudeSquared(v)), 12);
    }
  });

  it("returns 0 for the zero vector", () => {
    expect(magnitude({ x: 0, y: 0 })).toBe(0);
  });
});
