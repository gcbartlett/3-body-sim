import { describe, expect, it } from "vitest";
import {
  EJECTION_TIME_THRESHOLD_SECONDS,
  evaluateEjection,
} from "~/src/sim/ejection";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

const makeBodies = (overrides: Partial<BodyState>[] = []): BodyState[] => {
  const base: BodyState[] = [
    {
      id: "a",
      mass: 1,
      position: { x: 10, y: 0 },
      velocity: { x: 1, y: 0 },
      color: "#f00",
    },
    {
      id: "b",
      mass: 1,
      position: { x: -0.5, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#0f0",
    },
    {
      id: "c",
      mass: 1,
      position: { x: 0.5, y: 0 },
      velocity: { x: 0, y: 0 },
      color: "#00f",
    },
  ];

  return base.map((body, index) => ({ ...body, ...overrides[index] }));
};

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: makeBodies(),
  elapsedTime: 0,
  isRunning: true,
  ejectionCounterById: {},
  ejectedBodyId: null,
  ejectedBodyIds: [],
  dissolutionCounterSec: 0,
  dissolutionDetected: false,
  dissolutionJustDetected: false,
  ...overrides,
});

const makeParams = (overrides: Partial<SimParams> = {}): SimParams => ({
  G: 1,
  dt: 1,
  speed: 1,
  softening: 0.01,
  trailFade: 0.01,
  ...overrides,
});

describe("evaluateEjection", () => {
  it("increments a body's counter only when all ejection gates pass", () => {
    const result = evaluateEjection(
      makeWorld({
        bodies: makeBodies([
          {},
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
        ejectionCounterById: { a: 2.5 },
      }),
      makeParams({ dt: 0.75 }),
    );

    expect(result.ejectionCounterById.a).toBeCloseTo(3.25, 12);
  });

  it("resets counter to 0 when body no longer qualifies", () => {
    const result = evaluateEjection(
      makeWorld({
        bodies: makeBodies([{ position: { x: 2, y: 0 }, velocity: { x: 0, y: 0 } }]),
        ejectionCounterById: { a: 4.5 },
      }),
      makeParams({ dt: 1 }),
    );

    expect(result.ejectionCounterById.a).toBe(0);
  });

  it("marks first newly ejected body at threshold and stops running", () => {
    const result = evaluateEjection(
      makeWorld({
        ejectionCounterById: { a: EJECTION_TIME_THRESHOLD_SECONDS - 0.2 },
      }),
      makeParams({ dt: 0.5 }),
    );

    expect(result.ejectedBodyId).toBe("a");
    expect(result.ejectedBodyIds).toEqual(["a"]);
    expect(result.isRunning).toBe(false);
  });

  it("preserves already-ejected bodies and returns ids in world body order", () => {
    const result = evaluateEjection(
      makeWorld({
        bodies: makeBodies([
          { position: { x: 2, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 12, y: 0 }, velocity: { x: 1, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
        ejectedBodyIds: ["c"],
        ejectionCounterById: { b: EJECTION_TIME_THRESHOLD_SECONDS - 0.1 },
      }),
      makeParams({ dt: 0.2 }),
    );

    expect(result.ejectedBodyId).toBe("b");
    expect(result.ejectedBodyIds).toEqual(["b", "c"]);
  });

  it("does not decrement counters when params.dt is negative or zero", () => {
    const negativeDtResult = evaluateEjection(
      makeWorld({
        ejectionCounterById: { a: 3 },
      }),
      makeParams({ dt: -1 }),
    );
    const zeroDtResult = evaluateEjection(
      makeWorld({
        ejectionCounterById: { a: 3 },
      }),
      makeParams({ dt: 0 }),
    );

    expect(negativeDtResult.ejectionCounterById.a).toBe(3);
    expect(zeroDtResult.ejectionCounterById.a).toBe(3);
  });
});
