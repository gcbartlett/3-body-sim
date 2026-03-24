import { describe, expect, it } from "vitest";
import { computeAccelerations } from "~/src/sim/physics";
import type { BodyState, SimParams } from "~/src/sim/types";

const makeParams = (overrides: Partial<SimParams> = {}): SimParams => ({
  G: 1,
  dt: 1,
  speed: 1,
  softening: 0,
  trailFade: 0.01,
  ...overrides,
});

const makeBody = (
  id: string,
  mass: number,
  position: { x: number; y: number },
  velocity: { x: number; y: number } = { x: 0, y: 0 },
): BodyState => ({
  id,
  mass,
  position,
  velocity,
  color: "#ffffff",
});

describe("computeAccelerations", () => {
  it("computes opposite, mass-weighted accelerations for a two-body system", () => {
    const params = makeParams({ G: 4, softening: 0 });
    const bodies: BodyState[] = [
      makeBody("a", 2, { x: 0, y: 0 }),
      makeBody("b", 3, { x: 2, y: 0 }),
    ];

    const accelerations = computeAccelerations(bodies, params);

    expect(accelerations[0].x).toBeCloseTo(3, 12);
    expect(accelerations[0].y).toBeCloseTo(0, 12);
    expect(accelerations[1].x).toBeCloseTo(-2, 12);
    expect(accelerations[1].y).toBeCloseTo(0, 12);

    expect(2 * accelerations[0].x + 3 * accelerations[1].x).toBeCloseTo(0, 12);
    expect(2 * accelerations[0].y + 3 * accelerations[1].y).toBeCloseTo(0, 12);
  });

  it("returns finite accelerations for overlapping bodies when softening is applied", () => {
    const params = makeParams({ G: 10, softening: 0.5 });
    const bodies: BodyState[] = [
      makeBody("a", 1, { x: 1, y: 1 }),
      makeBody("b", 2, { x: 1, y: 1 }),
    ];

    const accelerations = computeAccelerations(bodies, params);

    for (const acc of accelerations) {
      expect(Number.isFinite(acc.x)).toBe(true);
      expect(Number.isFinite(acc.y)).toBe(true);
    }
  });

  it("returns zero acceleration for a one-body system", () => {
    const bodies: BodyState[] = [makeBody("solo", 5, { x: 10, y: -4 })];

    const accelerations = computeAccelerations(bodies, makeParams());

    expect(accelerations).toEqual([{ x: 0, y: 0 }]);
  });

  it("is translation invariant when all positions are shifted by the same vector", () => {
    const params = makeParams({ G: 2.5, softening: 0.1 });
    const baseBodies: BodyState[] = [
      makeBody("a", 1.2, { x: -2, y: 3 }),
      makeBody("b", 0.8, { x: 4, y: -1 }),
      makeBody("c", 2.1, { x: 0.5, y: 2.5 }),
    ];
    const shift = { x: 11, y: -7 };
    const shiftedBodies = baseBodies.map((body) =>
      makeBody(body.id, body.mass, {
        x: body.position.x + shift.x,
        y: body.position.y + shift.y,
      }),
    );

    const baseAccelerations = computeAccelerations(baseBodies, params);
    const shiftedAccelerations = computeAccelerations(shiftedBodies, params);

    expect(shiftedAccelerations).toHaveLength(baseAccelerations.length);
    for (let i = 0; i < baseAccelerations.length; i += 1) {
      expect(shiftedAccelerations[i].x).toBeCloseTo(baseAccelerations[i].x, 12);
      expect(shiftedAccelerations[i].y).toBeCloseTo(baseAccelerations[i].y, 12);
    }
  });
});
