import { describe, expect, it } from "vitest";
import {
  pairBindingStateForBodies,
  pairEnergiesForBodies,
} from "~/src/sim/diagnosticsSelectors";
import type { BodyState, SimParams } from "~/src/sim/types";

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
