import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

vi.mock("~/src/sim/diagnosticsSelectors", () => ({
  pairBindingStateForBodies: vi.fn(),
}));

import { pairBindingStateForBodies } from "~/src/sim/diagnosticsSelectors";
import {
  DISSOLUTION_TIME_THRESHOLD_SECONDS,
  applyBodyField,
  applyDissolutionProgress,
  appendTrailPoints,
  adjustedSimulationSpeed,
} from "~/src/sim/simulationPolicies";

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 1,
    position: { x: -1, y: 0 },
    velocity: { x: 0, y: 0 },
    color: "#f00",
  },
  {
    id: "b",
    mass: 1,
    position: { x: 1, y: 0 },
    velocity: { x: 0, y: 0 },
    color: "#0f0",
  },
  {
    id: "c",
    mass: 1,
    position: { x: 0, y: 1 },
    velocity: { x: 0, y: 0 },
    color: "#00f",
  },
];

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

describe("applyDissolutionProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pairBindingStateForBodies).mockReturnValue("binary+single");
  });

  it("increments only while pair state is dissolving and resets otherwise", () => {
    vi.mocked(pairBindingStateForBodies).mockReturnValueOnce("dissolving");
    const dissolvingResult = applyDissolutionProgress(makeWorld({ dissolutionCounterSec: 2 }), makeParams(), 1.5);

    expect(dissolvingResult.dissolutionCounterSec).toBeCloseTo(3.5, 12);

    vi.mocked(pairBindingStateForBodies).mockReturnValueOnce("binary+single");
    const nonDissolvingResult = applyDissolutionProgress(dissolvingResult, makeParams(), 0.5);

    expect(nonDissolvingResult.dissolutionCounterSec).toBe(0);
  });

  it("sets detection flags and stops running when threshold is crossed", () => {
    vi.mocked(pairBindingStateForBodies).mockReturnValue("dissolving");
    const result = applyDissolutionProgress(
      makeWorld({
        dissolutionCounterSec: DISSOLUTION_TIME_THRESHOLD_SECONDS - 0.25,
        isRunning: true,
      }),
      makeParams(),
      1,
    );

    expect(result.dissolutionDetected).toBe(true);
    expect(result.dissolutionJustDetected).toBe(true);
    expect(result.isRunning).toBe(false);
    expect(result.dissolutionCounterSec).toBeCloseTo(DISSOLUTION_TIME_THRESHOLD_SECONDS + 0.75, 12);
  });

  it("keeps dissolutionDetected true once already detected", () => {
    vi.mocked(pairBindingStateForBodies).mockReturnValue("binary+single");
    const result = applyDissolutionProgress(
      makeWorld({
        dissolutionDetected: true,
        dissolutionJustDetected: false,
        dissolutionCounterSec: 4,
      }),
      makeParams(),
      0.5,
    );

    expect(result.dissolutionDetected).toBe(true);
  });

  it("clamps negative stepDt at zero and never decreases the counter", () => {
    vi.mocked(pairBindingStateForBodies).mockReturnValue("dissolving");
    const result = applyDissolutionProgress(
      makeWorld({
        dissolutionCounterSec: 4,
      }),
      makeParams(),
      -3,
    );

    expect(result.dissolutionCounterSec).toBe(4);
  });
});

describe("applyBodyField", () => {
  const baseBody: BodyState = {
    id: "a",
    mass: 2,
    position: { x: 3, y: 4 },
    velocity: { x: 5, y: 6 },
    color: "#fff",
  };

  it("applies mass edits with a floor at 0.001", () => {
    const lowMass = applyBodyField(baseBody, "mass", -10);
    const regularMass = applyBodyField(baseBody, "mass", 7.25);

    expect(lowMass.mass).toBe(0.001);
    expect(regularMass.mass).toBe(7.25);
  });

  it("updates only the targeted position axis", () => {
    const resultX = applyBodyField(baseBody, "position.x", 11);
    const resultY = applyBodyField(baseBody, "position.y", -8);

    expect(resultX.position).toEqual({ x: 11, y: 4 });
    expect(resultY.position).toEqual({ x: 3, y: -8 });
  });

  it("updates only the targeted velocity axis", () => {
    const resultX = applyBodyField(baseBody, "velocity.x", 9);
    const resultY = applyBodyField(baseBody, "velocity.y", -2);

    expect(resultX.velocity).toEqual({ x: 9, y: 6 });
    expect(resultY.velocity).toEqual({ x: 5, y: -2 });
  });

  it("returns new object(s) and does not mutate the input body", () => {
    const original = {
      ...baseBody,
      position: { ...baseBody.position },
      velocity: { ...baseBody.velocity },
    };
    const result = applyBodyField(original, "position.x", 100);

    expect(result).not.toBe(original);
    expect(result.position).not.toBe(original.position);
    expect(result.velocity).toBe(original.velocity);
    expect(original).toEqual(baseBody);
  });
});

describe("appendTrailPoints", () => {
  const bodies: BodyState[] = [
    {
      id: "a",
      mass: 1,
      position: { x: 10, y: 20 },
      velocity: { x: 0, y: 0 },
      color: "#f00",
    },
    {
      id: "b",
      mass: 1,
      position: { x: -5, y: 4 },
      velocity: { x: 0, y: 0 },
      color: "#0f0",
    },
  ];

  it("appends one point per body at current position with life=1", () => {
    const trails = { a: [], b: [] };

    const result = appendTrailPoints(trails, bodies);

    expect(result.a.at(-1)).toEqual({ x: 10, y: 20, life: 1 });
    expect(result.b.at(-1)).toEqual({ x: -5, y: 4, life: 1 });
  });

  it("preserves existing trails for untouched bodies", () => {
    const trails = {
      a: [{ x: 1, y: 1, life: 0.5 }],
      b: [{ x: 2, y: 2, life: 0.75 }],
      c: [{ x: 3, y: 3, life: 1 }],
    };

    const result = appendTrailPoints(trails, bodies);

    expect(result.c).toEqual(trails.c);
  });

  it("enforces max per-body length of 2400 by keeping newest points", () => {
    const longTrail = Array.from({ length: 2400 }, (_, i) => ({ x: i, y: i * 2, life: 1 }));
    const trails = { a: longTrail };
    const singleBody = [bodies[0]];

    const result = appendTrailPoints(trails, singleBody);

    expect(result.a).toHaveLength(2400);
    expect(result.a[0]).toEqual({ x: 1, y: 2, life: 1 });
    expect(result.a[2399]).toEqual({ x: 10, y: 20, life: 1 });
  });

  it("returns a new map without mutating original trail arrays", () => {
    const trails = {
      a: [{ x: 1, y: 1, life: 0.5 }],
      c: [{ x: 3, y: 3, life: 1 }],
    };
    const originalA = trails.a;

    const result = appendTrailPoints(trails, [bodies[0]]);

    expect(result).not.toBe(trails);
    expect(result.a).not.toBe(originalA);
    expect(trails.a).toEqual([{ x: 1, y: 1, life: 0.5 }]);
    expect(result.c).toBe(trails.c);
  });
});

describe("adjustedSimulationSpeed", () => {
  it("multiplies by factor and rounds to three decimals", () => {
    const speed = adjustedSimulationSpeed(1.1111, 1.1111);

    expect(speed).toBe(1.235);
  });

  it("clamps to the lower bound at 0.01", () => {
    const speed = adjustedSimulationSpeed(0.02, 0.1);

    expect(speed).toBe(0.01);
  });

  it("clamps to the upper bound at 30", () => {
    const speed = adjustedSimulationSpeed(25, 2);

    expect(speed).toBe(30);
  });

  it("rounds boundary-adjacent values around x.xxx5 deterministically", () => {
    const belowHalf = adjustedSimulationSpeed(1.23449, 1);
    const aboveHalf = adjustedSimulationSpeed(1.23451, 1);

    expect(belowHalf).toBe(1.234);
    expect(aboveHalf).toBe(1.235);
  });
});
