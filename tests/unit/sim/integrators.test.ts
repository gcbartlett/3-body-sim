import { describe, expect, it, vi } from "vitest";
import type { BodyState, SimParams } from "~/src/sim/types";

vi.mock("~/src/sim/physics", () => ({
  computeAccelerations: vi.fn(),
}));

import { velocityVerletStep } from "~/src/sim/integrators";
import { computeAccelerations } from "~/src/sim/physics";

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 2,
    position: { x: 1, y: -2 },
    velocity: { x: 3, y: 4 },
    color: "#f00",
  },
  {
    id: "b",
    mass: 1,
    position: { x: -5, y: 6 },
    velocity: { x: -1, y: 2 },
    color: "#0f0",
  },
];

const makeParams = (overrides: Partial<SimParams> = {}): SimParams => ({
  G: 1,
  dt: 0.5,
  speed: 1,
  softening: 0.01,
  trailFade: 0.01,
  ...overrides,
});

describe("velocityVerletStep", () => {
  it("preserves positions and velocities when dt is 0", () => {
    vi.mocked(computeAccelerations)
      .mockReturnValueOnce([
        { x: 2, y: -3 },
        { x: -4, y: 5 },
      ])
      .mockReturnValueOnce([
        { x: 7, y: 8 },
        { x: 9, y: -10 },
      ]);
    const bodies = makeBodies();

    const result = velocityVerletStep(bodies, makeParams({ dt: 0 }));

    expect(result).toEqual(bodies);
  });

  it("matches constant-acceleration analytic update shape", () => {
    const constantAcceleration = [
      { x: 1.5, y: -0.5 },
      { x: -2, y: 0.25 },
    ];
    vi.mocked(computeAccelerations)
      .mockReturnValueOnce(constantAcceleration)
      .mockReturnValueOnce(constantAcceleration);
    const dt = 2;
    const bodies = makeBodies();

    const result = velocityVerletStep(bodies, makeParams({ dt }));

    expect(result[0].position).toEqual({
      x: 1 + 3 * dt + 0.5 * 1.5 * dt * dt,
      y: -2 + 4 * dt + 0.5 * -0.5 * dt * dt,
    });
    expect(result[0].velocity).toEqual({
      x: 3 + 1.5 * dt,
      y: 4 + -0.5 * dt,
    });
    expect(result[1].position).toEqual({
      x: -5 + -1 * dt + 0.5 * -2 * dt * dt,
      y: 6 + 2 * dt + 0.5 * 0.25 * dt * dt,
    });
    expect(result[1].velocity).toEqual({
      x: -1 + -2 * dt,
      y: 2 + 0.25 * dt,
    });
  });

  it("returns new body objects and does not mutate inputs", () => {
    vi.mocked(computeAccelerations)
      .mockReturnValueOnce([
        { x: 1, y: 1 },
        { x: -1, y: -1 },
      ])
      .mockReturnValueOnce([
        { x: 1, y: 1 },
        { x: -1, y: -1 },
      ]);
    const bodies = makeBodies();
    const originalSnapshot = structuredClone(bodies);

    const result = velocityVerletStep(bodies, makeParams({ dt: 1 }));

    expect(result).not.toBe(bodies);
    expect(result[0]).not.toBe(bodies[0]);
    expect(result[1]).not.toBe(bodies[1]);
    expect(bodies).toEqual(originalSnapshot);
  });

  it("uses averaged acceleration for velocity update", () => {
    const acc0 = [
      { x: 10, y: -6 },
      { x: 4, y: 2 },
    ];
    const acc1 = [
      { x: 2, y: 8 },
      { x: -6, y: 10 },
    ];
    vi.mocked(computeAccelerations).mockReturnValueOnce(acc0).mockReturnValueOnce(acc1);
    const dt = 0.4;
    const bodies = makeBodies();

    const result = velocityVerletStep(bodies, makeParams({ dt }));

    expect(result[0].velocity).toEqual({
      x: 3 + ((10 + 2) / 2) * dt,
      y: 4 + ((-6 + 8) / 2) * dt,
    });
    expect(result[1].velocity).toEqual({
      x: -1 + ((4 + -6) / 2) * dt,
      y: 2 + ((2 + 10) / 2) * dt,
    });
  });
});
