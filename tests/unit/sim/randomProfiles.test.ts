import { describe, expect, it, vi } from "vitest";
import {
  generateRandomChaoticBodies,
  generateRandomStableBodies,
} from "~/src/sim/randomProfiles";

const BODY_COLORS = ["#f7b731", "#60a5fa", "#8bd450"] as const;

const withMockedRandom = <T>(values: number[], run: () => T): T => {
  let index = 0;
  const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
    const next = values[index];
    ++index;
    return next ?? 0.5;
  });
  try {
    return run();
  } finally {
    randomSpy.mockRestore();
  }
};

describe("generateRandomStableBodies", () => {
  it("returns three bodies with stable ids and provided colors", () => {
    const bodies = withMockedRandom(Array(11).fill(0.5), () =>
      generateRandomStableBodies(BODY_COLORS),
    );

    expect(bodies).toHaveLength(3);
    expect(bodies.map((body) => body.id)).toEqual(["body-1", "body-2", "body-3"]);
    expect(bodies.map((body) => body.color)).toEqual(BODY_COLORS);
  });

  it("keeps masses/positions in configured ranges and velocities finite", () => {
    const bodies = withMockedRandom(Array(11).fill(0.5), () =>
      generateRandomStableBodies(BODY_COLORS),
    );

    for (const body of bodies) {
      expect(body.mass).toBeGreaterThanOrEqual(0.8);
      expect(body.mass).toBeLessThanOrEqual(1.3);
      const radius = Math.hypot(body.position.x, body.position.y);
      expect(radius).toBeGreaterThanOrEqual(0.9);
      expect(radius).toBeLessThanOrEqual(1.4);
      expect(Number.isFinite(body.velocity.x)).toBe(true);
      expect(Number.isFinite(body.velocity.y)).toBe(true);
    }
  });

  it("applies momentum correction so total momentum is near zero", () => {
    const bodies = withMockedRandom(Array(11).fill(0.5), () =>
      generateRandomStableBodies(BODY_COLORS),
    );

    const totalMomentum = bodies.reduce(
      (sum, body) => ({
        x: sum.x + body.mass * body.velocity.x,
        y: sum.y + body.mass * body.velocity.y,
      }),
      { x: 0, y: 0 },
    );

    expect(totalMomentum.x).toBeCloseTo(0, 12);
    expect(totalMomentum.y).toBeCloseTo(0, 12);
  });
});

describe("generateRandomChaoticBodies", () => {
  it("returns three bodies with stable ids/colors and values inside chaotic bounds", () => {
    const bodies = withMockedRandom(Array(15).fill(0.5), () =>
      generateRandomChaoticBodies(BODY_COLORS),
    );

    expect(bodies).toHaveLength(3);
    expect(bodies.map((body) => body.id)).toEqual(["body-1", "body-2", "body-3"]);
    expect(bodies.map((body) => body.color)).toEqual(BODY_COLORS);
    for (const body of bodies) {
      expect(body.mass).toBeGreaterThanOrEqual(0.5);
      expect(body.mass).toBeLessThanOrEqual(1.8);
      expect(body.position.x).toBeGreaterThanOrEqual(-1.2);
      expect(body.position.x).toBeLessThanOrEqual(1.2);
      expect(body.position.y).toBeGreaterThanOrEqual(-1.2);
      expect(body.position.y).toBeLessThanOrEqual(1.2);
      expect(body.velocity.x).toBeGreaterThanOrEqual(-1.5);
      expect(body.velocity.x).toBeLessThanOrEqual(1.5);
      expect(body.velocity.y).toBeGreaterThanOrEqual(-1.5);
      expect(body.velocity.y).toBeLessThanOrEqual(1.5);
    }
  });
});
