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
import {
  applyNewInitialStateTransition,
  buildNewInitialStateTransition,
  buildSingleStepTransition,
  buildStartPauseTransition,
  runStartPauseTransition,
} from "~/src/sim/sessionTransitions";

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

describe("buildNewInitialStateTransition", () => {
  it("returns stopped world clone with fresh baseline diagnostics", () => {
    const nextBodies = makeBodies();
    const nextParams = makeParams({ G: 1.5 });
    const baseline = { energy: 123, momentum: { x: 2, y: -3 } };
    const computeDiagnostics = vi.fn(() => baseline);

    const result = buildNewInitialStateTransition(nextBodies, nextParams, computeDiagnostics);

    expect(result.nextWorld.isRunning).toBe(false);
    expect(result.nextWorld.elapsedTime).toBe(0);
    expect(result.nextWorld.bodies).toEqual(nextBodies);
    expect(result.nextWorld.bodies).not.toBe(nextBodies);
    expect(result.nextWorld.bodies[0]).not.toBe(nextBodies[0]);
    expect(result.nextWorld.bodies[0].position).not.toBe(nextBodies[0].position);
    expect(computeDiagnostics).toHaveBeenCalledWith(result.nextWorld.bodies, nextParams);
    expect(result.baselineDiagnostics).toEqual(baseline);
  });
});

describe("applyNewInitialStateTransition", () => {
  it("updates world ref/state and baseline diagnostics from transition output", () => {
    const nextBodies = makeBodies();
    const nextParams = makeParams({ dt: 0.25 });
    const computeDiagnostics = vi.fn((bodies: BodyState[]) => ({
      energy: bodies.length,
      momentum: { x: 0, y: 0 },
    }));

    const worldRef = { current: makeWorld({ isRunning: true, elapsedTime: 9 }) };
    const trailsRef = { current: { a: [{ x: 1, y: 2, life: 0.5 }] } };
    const simStepCounterRef = { current: 99 };
    const setWorld = vi.fn();
    const setBaselineDiagnostics = vi.fn();

    applyNewInitialStateTransition(
      {
        worldRef: worldRef as never,
        trailsRef: trailsRef as never,
        simStepCounterRef: simStepCounterRef as never,
        setWorld,
        setBaselineDiagnostics,
      },
      nextBodies,
      nextParams,
      computeDiagnostics,
    );

    expect(worldRef.current).toEqual(expect.objectContaining({ isRunning: false, elapsedTime: 0 }));
    expect(worldRef.current.bodies).toEqual(nextBodies);
    expect(setWorld).toHaveBeenCalledWith(worldRef.current);
    expect(setBaselineDiagnostics).toHaveBeenCalledWith({
      energy: nextBodies.length,
      momentum: { x: 0, y: 0 },
    });
  });

  it("resets trailsRef.current to an empty map", () => {
    const worldRef = { current: makeWorld() };
    const trailsRef = { current: { a: [{ x: 1, y: 2, life: 1 }] } };
    const simStepCounterRef = { current: 12 };

    applyNewInitialStateTransition(
      {
        worldRef: worldRef as never,
        trailsRef: trailsRef as never,
        simStepCounterRef: simStepCounterRef as never,
        setWorld: vi.fn(),
        setBaselineDiagnostics: vi.fn(),
      },
      makeBodies(),
      makeParams(),
      vi.fn(() => ({ energy: 0, momentum: { x: 0, y: 0 } })),
    );

    expect(trailsRef.current).toEqual({});
  });

  it("resets simStepCounterRef.current to 0", () => {
    const worldRef = { current: makeWorld() };
    const trailsRef = { current: {} };
    const simStepCounterRef = { current: 47 };

    applyNewInitialStateTransition(
      {
        worldRef: worldRef as never,
        trailsRef: trailsRef as never,
        simStepCounterRef: simStepCounterRef as never,
        setWorld: vi.fn(),
        setBaselineDiagnostics: vi.fn(),
      },
      makeBodies(),
      makeParams(),
      vi.fn(() => ({ energy: 0, momentum: { x: 0, y: 0 } })),
    );

    expect(simStepCounterRef.current).toBe(0);
  });
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

describe("buildStartPauseTransition", () => {
  it("toggles isRunning on each call", () => {
    const computeDiagnostics = vi.fn(() => ({ energy: 1, momentum: { x: 0, y: 0 } }));

    const started = buildStartPauseTransition(makeWorld({ isRunning: false }), makeParams(), computeDiagnostics);
    const paused = buildStartPauseTransition(makeWorld({ isRunning: true }), makeParams(), computeDiagnostics);

    expect(started.nextWorld.isRunning).toBe(true);
    expect(paused.nextWorld.isRunning).toBe(false);
  });

  it("produces baseline diagnostics only when starting from stopped at elapsedTime===0", () => {
    const diagnostics = { energy: 42, momentum: { x: 1, y: -1 } };
    const computeDiagnostics = vi.fn(() => diagnostics);

    const initialStart = buildStartPauseTransition(
      makeWorld({ isRunning: false, elapsedTime: 0 }),
      makeParams(),
      computeDiagnostics,
    );
    const resumed = buildStartPauseTransition(
      makeWorld({ isRunning: false, elapsedTime: 1 }),
      makeParams(),
      computeDiagnostics,
    );
    const paused = buildStartPauseTransition(
      makeWorld({ isRunning: true, elapsedTime: 0 }),
      makeParams(),
      computeDiagnostics,
    );

    expect(initialStart.baselineDiagnostics).toEqual(diagnostics);
    expect(resumed.baselineDiagnostics).toBeNull();
    expect(paused.baselineDiagnostics).toBeNull();
  });

  it("clears ejectedBodyId when starting from stopped state", () => {
    const computeDiagnostics = vi.fn(() => ({ energy: 0, momentum: { x: 0, y: 0 } }));
    const result = buildStartPauseTransition(
      makeWorld({ isRunning: false, ejectedBodyId: "b" }),
      makeParams(),
      computeDiagnostics,
    );

    expect(result.nextWorld.ejectedBodyId).toBeNull();
  });

  it("clears dissolutionJustDetected when starting from stopped state", () => {
    const computeDiagnostics = vi.fn(() => ({ energy: 0, momentum: { x: 0, y: 0 } }));
    const result = buildStartPauseTransition(
      makeWorld({ isRunning: false, dissolutionJustDetected: true }),
      makeParams(),
      computeDiagnostics,
    );

    expect(result.nextWorld.dissolutionJustDetected).toBe(false);
  });

  it("leaves transient flags unchanged when pausing from running state", () => {
    const computeDiagnostics = vi.fn(() => ({ energy: 0, momentum: { x: 0, y: 0 } }));
    const result = buildStartPauseTransition(
      makeWorld({
        isRunning: true,
        ejectedBodyId: "c",
        dissolutionJustDetected: true,
      }),
      makeParams(),
      computeDiagnostics,
    );

    expect(result.nextWorld.ejectedBodyId).toBe("c");
    expect(result.nextWorld.dissolutionJustDetected).toBe(true);
  });
});

describe("runStartPauseTransition", () => {
  it("uses a functional setWorld updater, returns next world, and syncs refs/diagnostics when present", () => {
    const baseline = { energy: 7, momentum: { x: 2, y: -1 } };
    const computeDiagnostics = vi.fn(() => baseline);
    const setBaselineDiagnostics = vi.fn();
    const worldRef = { current: makeWorld({ isRunning: true }) };
    const paramsRef = { current: makeParams({ dt: 0.25 }) };

    let updater: ((prev: WorldState) => WorldState) | null = null;
    const setWorld = vi.fn((next: ((prev: WorldState) => WorldState) | WorldState) => {
      if (typeof next === "function") updater = next;
    });

    runStartPauseTransition(
      {
        worldRef: worldRef as never,
        paramsRef: paramsRef as never,
        setWorld,
        setBaselineDiagnostics,
      },
      computeDiagnostics,
    );

    expect(setWorld).toHaveBeenCalledTimes(1);
    expect(typeof setWorld.mock.calls[0][0]).toBe("function");

    const prev = makeWorld({ isRunning: false, elapsedTime: 0 });
    const next = updater!(prev);

    expect(next.isRunning).toBe(true);
    expect(worldRef.current).toBe(next);
    expect(computeDiagnostics).toHaveBeenCalledWith(prev.bodies, paramsRef.current);
    expect(setBaselineDiagnostics).toHaveBeenCalledWith(baseline);
  });

  it("does not set baseline diagnostics when transition baseline is null", () => {
    const computeDiagnostics = vi.fn(() => ({ energy: 1, momentum: { x: 0, y: 0 } }));
    const setBaselineDiagnostics = vi.fn();
    const worldRef = { current: makeWorld({ isRunning: true }) };
    const paramsRef = { current: makeParams() };

    let updater: ((prev: WorldState) => WorldState) | null = null;
    const setWorld = vi.fn((next: ((prev: WorldState) => WorldState) | WorldState) => {
      if (typeof next === "function") updater = next;
    });

    runStartPauseTransition(
      {
        worldRef: worldRef as never,
        paramsRef: paramsRef as never,
        setWorld,
        setBaselineDiagnostics,
      },
      computeDiagnostics,
    );

    updater!(makeWorld({ isRunning: false, elapsedTime: 2 }));

    expect(setBaselineDiagnostics).not.toHaveBeenCalled();
  });
});
