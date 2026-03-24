import { describe, expect, it } from "vitest";
import {
  EJECTION_TIME_THRESHOLD_SECONDS,
  coreEscapeMetricsForBody,
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

describe("coreEscapeMetricsForBody", () => {
  it("returns null for out-of-range body index and for fewer than 3 bodies", () => {
    const outOfRange = coreEscapeMetricsForBody(99, makeWorld(), makeParams());
    const tooFewBodies = coreEscapeMetricsForBody(
      0,
      makeWorld({ bodies: makeBodies().slice(0, 2) }),
      makeParams(),
    );

    expect(outOfRange).toBeNull();
    expect(tooFewBodies).toBeNull();
  });

  it("produces stable finite outputs under near-zero separations", () => {
    const world = makeWorld({
      bodies: makeBodies([
        { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
        { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
        { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } },
      ]),
    });

    const metrics = coreEscapeMetricsForBody(0, world, makeParams());

    expect(metrics).not.toBeNull();
    if (!metrics) {
      throw new Error("Expected metrics for in-range body");
    }
    expect(Number.isFinite(metrics.energy)).toBe(true);
    expect(Number.isFinite(metrics.speedRatioToEscape)).toBe(true);
    expect(Number.isFinite(metrics.coreSeparation)).toBe(true);
    expect(Number.isFinite(metrics.farCoreRatio)).toBe(true);
    expect(Number.isFinite(metrics.relPosition.x)).toBe(true);
    expect(Number.isFinite(metrics.relPosition.y)).toBe(true);
    expect(Number.isFinite(metrics.relVelocity.x)).toBe(true);
    expect(Number.isFinite(metrics.relVelocity.y)).toBe(true);
  });

  it("flags outward from the radial dot-product sign", () => {
    const outwardMetrics = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          { position: { x: 10, y: 0 }, velocity: { x: 1, y: 0 } },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      makeParams(),
    );
    const inwardMetrics = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          { position: { x: 10, y: 0 }, velocity: { x: -1, y: 0 } },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      makeParams(),
    );

    expect(outwardMetrics?.outward).toBe(true);
    expect(inwardMetrics?.outward).toBe(false);
  });

  it("sets strongEscape around ratio threshold and outward-enough gate", () => {
    const params = makeParams();
    const ratioThreshold = 1.08;
    const baselineMetrics = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          { position: { x: 10, y: 0 }, velocity: { x: 1, y: 0 } },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      params,
    );
    if (!baselineMetrics) {
      throw new Error("Expected baseline metrics");
    }

    const thresholdSpeed = ratioThreshold / baselineMetrics.speedRatioToEscape;
    const belowThresholdSpeed = thresholdSpeed - 1e-6;
    const aboveThresholdSpeed = thresholdSpeed + 1e-6;

    const belowThreshold = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          { position: { x: 10, y: 0 }, velocity: { x: belowThresholdSpeed, y: 0 } },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      params,
    );
    const aboveThreshold = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          { position: { x: 10, y: 0 }, velocity: { x: aboveThresholdSpeed, y: 0 } },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      params,
    );
    const outwardTooSmall = coreEscapeMetricsForBody(
      0,
      makeWorld({
        bodies: makeBodies([
          {
            position: { x: 10, y: 0 },
            velocity: { x: aboveThresholdSpeed * 0.01, y: aboveThresholdSpeed },
          },
          { position: { x: -0.5, y: 0 }, velocity: { x: 0, y: 0 } },
          { position: { x: 0.5, y: 0 }, velocity: { x: 0, y: 0 } },
        ]),
      }),
      params,
    );

    expect(belowThreshold?.speedRatioToEscape).toBeLessThan(ratioThreshold);
    expect(aboveThreshold?.speedRatioToEscape).toBeGreaterThan(ratioThreshold);
    expect(belowThreshold?.strongEscape).toBe(false);
    expect(aboveThreshold?.strongEscape).toBe(true);
    expect(outwardTooSmall?.outward).toBe(true);
    expect(outwardTooSmall?.strongEscape).toBe(false);
  });
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
