import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";
import type { TrailMap } from "~/src/render/canvasRenderer";

vi.mock("~/src/sim/integrators", () => ({
  velocityVerletStep: vi.fn(),
}));

vi.mock("~/src/sim/ejection", () => ({
  evaluateEjection: vi.fn(),
}));

import { evaluateEjection } from "~/src/sim/ejection";
import { velocityVerletStep } from "~/src/sim/integrators";
import { advanceRunningWorldStep, effectiveSimulationDt } from "~/src/sim/simulationTick";

const makeBodies = (): BodyState[] => [
  {
    id: "a",
    mass: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 1, y: 0 },
    color: "#ff0000",
  },
  {
    id: "b",
    mass: 1,
    position: { x: 1, y: 0 },
    velocity: { x: -1, y: 0 },
    color: "#00ff00",
  },
  {
    id: "c",
    mass: 1,
    position: { x: 0, y: 1 },
    velocity: { x: 0, y: -1 },
    color: "#0000ff",
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

describe("effectiveSimulationDt", () => {
  it("matches base dt at speed <= 1 and scales up at higher speed", () => {
    expect(effectiveSimulationDt(makeParams({ dt: 0.5, speed: 1 }))).toBeCloseTo(0.5, 12);
    expect(effectiveSimulationDt(makeParams({ dt: 0.5, speed: 0.5 }))).toBeCloseTo(0.5, 12);
    expect(effectiveSimulationDt(makeParams({ dt: 0.5, speed: 10 }))).toBeGreaterThan(0.5);
  });
});

describe("advanceRunningWorldStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(velocityVerletStep).mockImplementation((bodies) => bodies.map((body) => ({ ...body })));
    vi.mocked(evaluateEjection).mockImplementation((world) => ({
      ejectionCounterById: world.ejectionCounterById,
      ejectedBodyId: null,
      ejectedBodyIds: world.ejectedBodyIds,
      isRunning: true,
    }));
  });

  it("returns unchanged values when world is not running", () => {
    const currentWorld = makeWorld({ isRunning: false });
    const trails: TrailMap = { a: [{ x: 0, y: 0, life: 1 }] };
    const appendTrailPoints = vi.fn((nextTrails: TrailMap) => nextTrails);
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = advanceRunningWorldStep({
      currentWorld,
      currentParams: makeParams(),
      dtReal: 0.5,
      accumulator: 0.25,
      trails,
      simStepCounter: 7,
      appendTrailPoints,
      applyDissolutionProgress,
    });

    expect(result.nextWorld).toBe(currentWorld);
    expect(result.nextAccumulator).toBe(0.25);
    expect(result.nextTrails).toBe(trails);
    expect(result.nextSimStepCounter).toBe(7);
    expect(result.worldChanged).toBe(false);
    expect(velocityVerletStep).not.toHaveBeenCalled();
    expect(evaluateEjection).not.toHaveBeenCalled();
    expect(appendTrailPoints).not.toHaveBeenCalled();
    expect(applyDissolutionProgress).not.toHaveBeenCalled();
  });

  it("advances a single step and consumes exactly one effective dt", () => {
    const steppedBodies = makeBodies().map((body) => ({
      ...body,
      position: { x: body.position.x + 10, y: body.position.y + 20 },
    }));
    vi.mocked(velocityVerletStep).mockReturnValue(steppedBodies);

    const currentWorld = makeWorld({ elapsedTime: 3 });
    const appendTrailPoints = vi.fn((nextTrails: TrailMap) => nextTrails);
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = advanceRunningWorldStep({
      currentWorld,
      currentParams: makeParams({ dt: 1, speed: 1 }),
      dtReal: 0.7,
      accumulator: 0.4,
      trails: {},
      simStepCounter: 0,
      appendTrailPoints,
      applyDissolutionProgress,
    });

    expect(result.nextWorld.elapsedTime).toBe(4);
    expect(result.nextWorld.bodies).toBe(steppedBodies);
    expect(result.nextAccumulator).toBeCloseTo(0.1, 12);
    expect(result.nextSimStepCounter).toBe(1);
    expect(result.worldChanged).toBe(true);
    expect(velocityVerletStep).toHaveBeenCalledTimes(1);
    expect(evaluateEjection).toHaveBeenCalledWith(
      expect.objectContaining({ bodies: steppedBodies, elapsedTime: 4 }),
      expect.objectContaining({ dt: 1 }),
    );
  });

  it("stops immediately when ejection sets isRunning=false", () => {
    vi.mocked(evaluateEjection).mockReturnValue({
      ejectionCounterById: { a: 10 },
      ejectedBodyId: "a",
      ejectedBodyIds: ["a"],
      isRunning: false,
    });

    const currentWorld = makeWorld();
    const appendTrailPoints = vi.fn((nextTrails: TrailMap) => nextTrails);
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = advanceRunningWorldStep({
      currentWorld,
      currentParams: makeParams({ dt: 1, speed: 1 }),
      dtReal: 3,
      accumulator: 0,
      trails: {},
      simStepCounter: 0,
      appendTrailPoints,
      applyDissolutionProgress,
    });

    expect(result.nextWorld.isRunning).toBe(false);
    expect(result.nextWorld.ejectedBodyId).toBe("a");
    expect(result.nextWorld.ejectedBodyIds).toEqual(["a"]);
    expect(result.nextAccumulator).toBe(2);
    expect(result.nextSimStepCounter).toBe(1);
    expect(velocityVerletStep).toHaveBeenCalledTimes(1);
    expect(evaluateEjection).toHaveBeenCalledTimes(1);
    expect(applyDissolutionProgress).toHaveBeenCalledTimes(1);
  });

  it("caps large backlog to maxBacklog", () => {
    const currentWorld = makeWorld();
    const appendTrailPoints = vi.fn((nextTrails: TrailMap) => nextTrails);
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = advanceRunningWorldStep({
      currentWorld,
      currentParams: makeParams({ dt: 1, speed: 1 }),
      dtReal: 0,
      accumulator: 1000,
      trails: {},
      simStepCounter: 0,
      appendTrailPoints,
      applyDissolutionProgress,
    });

    expect(result.nextAccumulator).toBe(32);
    expect(velocityVerletStep).toHaveBeenCalledTimes(32);
  });

  it("samples trails only when simStepCounter is divisible by trailSampleEvery", () => {
    let step = 0;
    vi.mocked(velocityVerletStep).mockImplementation((bodies) => {
      step += 1;
      return bodies.map((body) => ({
        ...body,
        position: {
          x: body.position.x + step,
          y: body.position.y + step,
        },
      }));
    });

    const appendTrailPoints = vi.fn((nextTrails: TrailMap) => nextTrails);
    const applyDissolutionProgress = vi.fn((world: WorldState) => world);

    const result = advanceRunningWorldStep({
      currentWorld: makeWorld(),
      currentParams: makeParams({ dt: 1, speed: 3 }),
      dtReal: 3.9,
      accumulator: 0,
      trails: {},
      simStepCounter: 1,
      appendTrailPoints,
      applyDissolutionProgress,
    });

    expect(result.nextSimStepCounter).toBe(6);
    expect(velocityVerletStep).toHaveBeenCalledTimes(5);
    expect(appendTrailPoints).toHaveBeenCalledTimes(2);
  });
});
