import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

vi.mock("~/src/sim/diagnosticsSelectors", () => ({
  pairBindingStateForBodies: vi.fn(),
}));

import { pairBindingStateForBodies } from "~/src/sim/diagnosticsSelectors";
import {
  DISSOLUTION_TIME_THRESHOLD_SECONDS,
  applyDissolutionProgress,
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
