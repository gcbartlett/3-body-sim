import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

vi.mock("~/src/sim/integrators", () => ({
  velocityVerletStep: vi.fn(),
}));

vi.mock("~/src/sim/ejection", () => ({
  evaluateEjection: vi.fn(),
}));

import { evaluateEjection } from "~/src/sim/ejection";
import { velocityVerletStep } from "~/src/sim/integrators";
import { buildSingleStepTransition } from "~/src/sim/sessionTransitions";

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 1, y: 0 },
    color: "#f00",
  },
  {
    id: "b",
    mass: 1,
    position: { x: 1, y: 0 },
    velocity: { x: -1, y: 0 },
    color: "#0f0",
  },
  {
    id: "c",
    mass: 1,
    position: { x: 0, y: 1 },
    velocity: { x: 0, y: -1 },
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

describe("buildSingleStepTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(velocityVerletStep).mockImplementation((bodies) => bodies.map((body) => ({ ...body })));
    vi.mocked(evaluateEjection).mockImplementation((world) => ({
      ejectionCounterById: world.ejectionCounterById,
      ejectedBodyId: world.ejectedBodyId,
      ejectedBodyIds: world.ejectedBodyIds,
      isRunning: world.isRunning,
    }));
  });

  it("always sets isRunning=false after a single-step transition", () => {
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);
    const result = buildSingleStepTransition(makeWorld({ isRunning: true }), makeParams(), applyDissolutionProgress);

    expect(result.isRunning).toBe(false);
  });

  it("increments elapsedTime by exactly params.dt", () => {
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);
    const params = makeParams({ dt: 0.125 });
    const result = buildSingleStepTransition(
      makeWorld({ elapsedTime: 10 }),
      params,
      applyDissolutionProgress,
    );

    expect(result.elapsedTime).toBe(10.125);
  });

  it("pipes velocity step output into ejection evaluation and dissolution progression", () => {
    const steppedBodies = makeBodies().map((body) => ({
      ...body,
      position: { x: body.position.x + 10, y: body.position.y + 20 },
    }));
    vi.mocked(velocityVerletStep).mockReturnValue(steppedBodies);
    vi.mocked(evaluateEjection).mockReturnValue({
      ejectionCounterById: { a: 2 },
      ejectedBodyId: "a",
      ejectedBodyIds: ["a"],
      isRunning: false,
    });
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);
    const currentWorld = makeWorld({ elapsedTime: 3 });
    const params = makeParams({ dt: 0.5 });

    buildSingleStepTransition(currentWorld, params, applyDissolutionProgress);

    expect(velocityVerletStep).toHaveBeenCalledWith(currentWorld.bodies, params);
    expect(evaluateEjection).toHaveBeenCalledWith(
      expect.objectContaining({
        bodies: steppedBodies,
        elapsedTime: 3.5,
      }),
      params,
    );
    expect(applyDissolutionProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        bodies: steppedBodies,
        ejectionCounterById: { a: 2 },
        ejectedBodyId: "a",
        ejectedBodyIds: ["a"],
      }),
      params,
      params.dt,
    );
  });

  it("carries forward ejection fields from evaluateEjection", () => {
    vi.mocked(evaluateEjection).mockReturnValue({
      ejectionCounterById: { b: 9 },
      ejectedBodyId: "b",
      ejectedBodyIds: ["b", "c"],
      isRunning: false,
    });
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = buildSingleStepTransition(makeWorld(), makeParams(), applyDissolutionProgress);

    expect(result.ejectionCounterById).toEqual({ b: 9 });
    expect(result.ejectedBodyId).toBe("b");
    expect(result.ejectedBodyIds).toEqual(["b", "c"]);
  });
});
