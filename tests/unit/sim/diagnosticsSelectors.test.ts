import { describe, expect, it } from "vitest";
import {
  bodyEjectionStatusesForDisplay,
  bodyVectorsForDisplay,
  DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  diagnosticsDriftMetrics,
  displayPairStateFromEnergies,
  pairBindingStateForBodies,
  pairEnergiesForBodies,
  stageDiagnosticsViewModelForWorld,
} from "~/src/sim/diagnosticsSelectors";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

const makeParams = (overrides: Partial<SimParams> = {}): SimParams => ({
  G: 1,
  dt: 1,
  speed: 1,
  softening: 0,
  trailFade: 0.01,
  ...overrides,
});

const makeBodies = (overrides: Partial<BodyState>[] = []): BodyState[] => {
  const base: BodyState[] = [
    {
      id: "a",
      mass: 1,
      position: { x: 0, y: 0 },
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

  return base.map((body, index) => ({ ...body, ...overrides[index] }));
};

const negativePairEnergyCount = (bodies: BodyState[], params: SimParams): number => {
  const { eps12, eps13, eps23 } = pairEnergiesForBodies(bodies, params);
  return [eps12, eps13, eps23].filter((energy) => energy < 0).length;
};

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

describe("pairBindingStateForBodies", () => {
  it('returns "dissolving" when no pair energies are negative', () => {
    const bodies = makeBodies();
    const params = makeParams({ G: 0 });
    const result = pairBindingStateForBodies(bodies, params);

    expect(negativePairEnergyCount(bodies, params)).toBe(0);
    expect(result).toBe("dissolving");
  });

  it('returns "binary+single" when exactly one pair energy is negative', () => {
    const bodies = makeBodies([
      { velocity: { x: 0, y: 0 } },
      { velocity: { x: 0, y: 0 } },
      { velocity: { x: 3, y: 0 } },
    ]);
    const params = makeParams({ G: 1 });
    const result = pairBindingStateForBodies(bodies, params);

    expect(negativePairEnergyCount(bodies, params)).toBe(1);
    expect(result).toBe("binary+single");
  });

  it('returns "resonant" when two or three pair energies are negative', () => {
    const twoNegativeBodies = makeBodies([
      { position: { x: -10, y: 0 }, velocity: { x: 0.3, y: 0 } },
      { position: { x: 10, y: 0 }, velocity: { x: -0.3, y: 0 } },
      { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
    ]);
    const threeNegativeBodies = makeBodies();
    const params = makeParams({ G: 1 });
    const twoNegative = pairBindingStateForBodies(twoNegativeBodies, params);
    const threeNegative = pairBindingStateForBodies(threeNegativeBodies, params);

    expect(negativePairEnergyCount(twoNegativeBodies, params)).toBe(2);
    expect(negativePairEnergyCount(threeNegativeBodies, params)).toBe(3);
    expect(twoNegative).toBe("resonant");
    expect(threeNegative).toBe("resonant");
  });
});

describe("displayPairStateFromEnergies", () => {
  it("applies strict energy < -eps threshold to compute nbound", () => {
    const result = displayPairStateFromEnergies(-0.05, -0.051, -0.2, false);

    expect(result.nbound).toBe(2);
    expect(result.state).toBe("resonant");
  });

  it('forces "binary+single" when anyEjected=true and nbound>0', () => {
    const result = displayPairStateFromEnergies(-1, -1, -1, true);

    expect(result.nbound).toBe(3);
    expect(result.state).toBe("binary+single");
  });

  it('maps nbound 0/1/2+ to dissolving/binary+single/resonant without ejection', () => {
    const noneBound = displayPairStateFromEnergies(0.1, -0.01, -0.02, false);
    const oneBound = displayPairStateFromEnergies(-0.06, -0.01, -0.02, false);
    const twoBound = displayPairStateFromEnergies(-0.06, -0.07, -0.01, false);

    expect(noneBound).toEqual({ nbound: 0, state: "dissolving" });
    expect(oneBound).toEqual({ nbound: 1, state: "binary+single" });
    expect(twoBound).toEqual({ nbound: 2, state: "resonant" });
  });

  it("honors custom displayPairEnergyEps", () => {
    const defaultThreshold = displayPairStateFromEnergies(-0.08, -0.07, 0.1, false);
    const customThreshold = displayPairStateFromEnergies(-0.08, -0.07, 0.1, false, 0.09);

    expect(defaultThreshold).toEqual({ nbound: 2, state: "resonant" });
    expect(customThreshold).toEqual({ nbound: 0, state: "dissolving" });
  });
});

describe("pairEnergiesForBodies", () => {
  it("computes eps12/eps13/eps23 in the expected pair order", () => {
    const energies = pairEnergiesForBodies(
      makeBodies([
        { velocity: { x: 0, y: 0 } },
        { velocity: { x: 2, y: 0 } },
        { velocity: { x: 0, y: 3 } },
      ]),
      makeParams({ G: 0 }),
    );

    expect(energies.eps12).toBeCloseTo(2, 12);
    expect(energies.eps13).toBeCloseTo(4.5, 12);
    expect(energies.eps23).toBeCloseTo(6.5, 12);
  });

  it("uses softened distance term and remains finite near zero separation", () => {
    const energies = pairEnergiesForBodies(
      makeBodies([
        { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
        { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
        { position: { x: 1e-12, y: -1e-12 }, velocity: { x: 0, y: 0 } },
      ]),
      makeParams({ G: 10, softening: 0.1 }),
    );

    expect(Number.isFinite(energies.eps12)).toBe(true);
    expect(Number.isFinite(energies.eps13)).toBe(true);
    expect(Number.isFinite(energies.eps23)).toBe(true);
  });

  it("returns 0 for energies involving missing pair members", () => {
    const energies = pairEnergiesForBodies(
      makeBodies([
        {},
        {},
      ]).slice(0, 2),
      makeParams(),
    );

    expect(energies.eps13).toBe(0);
    expect(energies.eps23).toBe(0);
    expect(energies.eps12).not.toBe(0);
  });
});

describe("stageDiagnosticsViewModelForWorld", () => {
  it("returns displayPairState.eps for both default and custom displayPairEnergyEps", () => {
    const world = makeWorld();
    const params = makeParams();

    const withDefaultEps = stageDiagnosticsViewModelForWorld({
      world,
      params,
      ejectionThresholdSec: 10,
    });
    const withCustomEps = stageDiagnosticsViewModelForWorld({
      world,
      params,
      ejectionThresholdSec: 10,
      displayPairEnergyEps: 0.09,
    });

    expect(withDefaultEps.displayPairState.eps).toBe(DEFAULT_DISPLAY_PAIR_ENERGY_EPS);
    expect(withCustomEps.displayPairState.eps).toBe(0.09);
  });

  it('forces "binary+single" when any body is ejected and nbound > 0', () => {
    const params = makeParams({ G: 1 });
    const worldWithoutEjection = makeWorld();
    const worldWithEjection = makeWorld({ ejectedBodyIds: ["a"] });

    const withoutEjection = stageDiagnosticsViewModelForWorld({
      world: worldWithoutEjection,
      params,
      ejectionThresholdSec: 10,
    });
    const withEjection = stageDiagnosticsViewModelForWorld({
      world: worldWithEjection,
      params,
      ejectionThresholdSec: 10,
    });

    expect(withoutEjection.displayPairState.nbound).toBeGreaterThan(0);
    expect(withoutEjection.displayPairState.state).toBe("resonant");
    expect(withEjection.displayPairState.nbound).toBeGreaterThan(0);
    expect(withEjection.displayPairState.state).toBe("binary+single");
  });

  it("wires pair energies, body vectors, and ejection statuses from the same world/params", () => {
    const world = makeWorld({
      ejectionCounterById: { a: 2.5, b: 0, c: 0.1 },
      ejectedBodyIds: ["b"],
    });
    const params = makeParams({ G: 1.2, softening: 0.05 });
    const ejectionThresholdSec = 12;

    const viewModel = stageDiagnosticsViewModelForWorld({
      world,
      params,
      ejectionThresholdSec,
    });

    expect(viewModel.pairEnergies).toEqual(pairEnergiesForBodies(world.bodies, params));
    expect(viewModel.bodyVectors).toEqual(bodyVectorsForDisplay(world.bodies, params));
    expect(viewModel.bodyEjectionStatuses).toEqual(
      bodyEjectionStatusesForDisplay(world, params, ejectionThresholdSec),
    );
  });

  it("produces one body vector and one ejection status per body index", () => {
    const world = makeWorld();
    const params = makeParams();

    const viewModel = stageDiagnosticsViewModelForWorld({
      world,
      params,
      ejectionThresholdSec: 10,
    });

    expect(viewModel.bodyVectors).toHaveLength(world.bodies.length);
    expect(viewModel.bodyEjectionStatuses).toHaveLength(world.bodies.length);
    expect(viewModel.bodyVectors.map((entry) => entry.id)).toEqual(world.bodies.map((body) => body.id));
    expect(viewModel.bodyEjectionStatuses.map((entry) => entry.id)).toEqual(
      world.bodies.map((body) => body.id),
    );
  });
});

describe("diagnosticsDriftMetrics", () => {
  it("computes signed deltaEnergy and non-negative energyDriftPct", () => {
    const result = diagnosticsDriftMetrics(
      { energy: 8, momentum: { x: 0, y: 0 } },
      { energy: 10, momentum: { x: 0, y: 0 } },
    );

    expect(result.deltaEnergy).toBe(-2);
    expect(result.energyDriftPct).toBe(20);
  });

  it("computes deltaMomentumMag from the momentum vector delta norm", () => {
    const result = diagnosticsDriftMetrics(
      { energy: 1, momentum: { x: 3, y: 4 } },
      { energy: 1, momentum: { x: 0, y: 0 } },
    );

    expect(result.deltaMomentumMag).toBe(5);
  });

  it("uses the 1e-9 denominator floor when baseline energy is zero", () => {
    const result = diagnosticsDriftMetrics(
      { energy: 2, momentum: { x: 0, y: 0 } },
      { energy: 0, momentum: { x: 0, y: 0 } },
    );

    expect(result.energyDriftPct).toBeCloseTo(2e11, 4);
  });

  it("uses the 1e-9 denominator floor when baseline momentum magnitude is zero", () => {
    const result = diagnosticsDriftMetrics(
      { energy: 0, momentum: { x: 3, y: 4 } },
      { energy: 0, momentum: { x: 0, y: 0 } },
    );

    expect(result.momentumDriftPct).toBeCloseTo(5e11, 4);
  });
});
