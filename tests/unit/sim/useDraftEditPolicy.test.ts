import { describe, expect, it, vi } from "vitest";
import { useDraftEditPolicy } from "~/src/sim/useDraftEditPolicy";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";
import type { SimulationHistory } from "~/src/sim/simulationHistory";

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
];

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: makeBodies(),
  elapsedTime: 0,
  isRunning: false,
  ejectionCounterById: {},
  ejectedBodyId: null,
  ejectedBodyIds: [],
  dissolutionCounterSec: 0,
  dissolutionDetected: false,
  dissolutionJustDetected: false,
  ...overrides,
});

const makeParams = (): SimParams => ({
  G: 1,
  dt: 0.01,
  speed: 1,
  softening: 0.001,
  trailFade: 0.02,
});

describe("useDraftEditPolicy", () => {
  const makeHistoryRef = (): { current: SimulationHistory } => ({
    current: {
      snapshots: [
        {
          world: makeWorld({ elapsedTime: 5, isRunning: true }),
          accumulator: 1,
          simStepCounter: 2,
          forceFastZoomInFrames: 3,
        },
      ],
      maxSteps: 300,
    },
  });

  it("clears history when body edits rebuild stopped initial world", () => {
    const worldRef = { current: makeWorld() };
    const paramsRef = { current: makeParams() };
    const historyRef = makeHistoryRef();
    const setWorld = vi.fn();
    const setParams = vi.fn();
    const setBaselineDiagnostics = vi.fn();
    let draftBodies = makeBodies();
    const setDraftBodies = vi.fn((updater: (prev: BodyState[]) => BodyState[]) => {
      draftBodies = updater(draftBodies);
    });

    const handlers = useDraftEditPolicy({
      worldRef: worldRef as never,
      paramsRef: paramsRef as never,
      historyRef: historyRef as never,
      setWorld,
      setParams,
      setDraftBodies,
      setBaselineDiagnostics,
    });

    handlers.onBodyChange(0, "mass", 2);

    expect(historyRef.current.snapshots).toEqual([]);
    expect(setWorld).toHaveBeenCalledTimes(1);
    expect(setParams).not.toHaveBeenCalled();
    expect(setBaselineDiagnostics).toHaveBeenCalledTimes(1);
    expect(draftBodies[0].mass).toBe(2);
  });

  it("clears history when param edits update stopped initial baseline", () => {
    const worldRef = { current: makeWorld() };
    const paramsRef = { current: makeParams() };
    const historyRef = makeHistoryRef();
    const setWorld = vi.fn();
    const setParams = vi.fn();
    const setBaselineDiagnostics = vi.fn();
    const setDraftBodies = vi.fn();

    const handlers = useDraftEditPolicy({
      worldRef: worldRef as never,
      paramsRef: paramsRef as never,
      historyRef: historyRef as never,
      setWorld,
      setParams,
      setDraftBodies,
      setBaselineDiagnostics,
    });

    handlers.onParamChange("dt", 0.02);

    expect(historyRef.current.snapshots).toEqual([]);
    expect(setWorld).not.toHaveBeenCalled();
    expect(setParams).toHaveBeenCalledTimes(1);
    expect(setBaselineDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("clears history when reset params updates stopped initial baseline", () => {
    const worldRef = { current: makeWorld() };
    const paramsRef = { current: makeParams() };
    const historyRef = makeHistoryRef();
    const setWorld = vi.fn();
    const setParams = vi.fn();
    const setBaselineDiagnostics = vi.fn();
    const setDraftBodies = vi.fn();

    const handlers = useDraftEditPolicy({
      worldRef: worldRef as never,
      paramsRef: paramsRef as never,
      historyRef: historyRef as never,
      setWorld,
      setParams,
      setDraftBodies,
      setBaselineDiagnostics,
    });

    handlers.onResetParams();

    expect(historyRef.current.snapshots).toEqual([]);
    expect(setWorld).not.toHaveBeenCalled();
    expect(setParams).toHaveBeenCalledTimes(1);
    expect(setBaselineDiagnostics).toHaveBeenCalledTimes(1);
  });
});
