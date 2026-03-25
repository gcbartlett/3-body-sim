import { describe, expect, it } from "vitest";
import {
  buildHoverTooltipLines,
  buildHoverTooltipSnapshotForBodyIndex,
  findBodyIndexById,
  findNearestBodyIndexAtScreenPoint,
} from "~/src/sim/hoverDiagnostics";
import type { BodyState, SimParams, WorldState } from "~/src/sim/types";

const makeBodies = (): BodyState[] => [
  {
    id: "body-1",
    mass: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    color: "#f00",
  },
  {
    id: "body-2",
    mass: 1,
    position: { x: 10, y: 0 },
    velocity: { x: 3, y: 4 },
    color: "#0f0",
  },
  {
    id: "body-3",
    mass: 1,
    position: { x: 0, y: 10 },
    velocity: { x: -1, y: 0.5 },
    color: "#00f",
  },
];

const makeParams = (overrides: Partial<SimParams> = {}): SimParams => ({
  G: 1,
  dt: 1,
  speed: 1,
  softening: 0.01,
  trailFade: 0.02,
  ...overrides,
});

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

describe("findBodyIndexById", () => {
  it("returns matching index or -1 when missing", () => {
    const bodies = makeBodies();

    expect(findBodyIndexById(bodies, "body-2")).toBe(1);
    expect(findBodyIndexById(bodies, "missing")).toBe(-1);
  });
});

describe("findNearestBodyIndexAtScreenPoint", () => {
  it("returns nearest body within threshold and null outside threshold", () => {
    const bodies = makeBodies();
    const camera = { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 };
    const viewport = { width: 100, height: 100 };

    const near = findNearestBodyIndexAtScreenPoint(bodies, camera, viewport, 59, 50, 3);
    const far = findNearestBodyIndexAtScreenPoint(bodies, camera, viewport, 0, 0, 5);

    expect(near).toEqual({ bodyIndex: 1, screen: { x: 60, y: 50 } });
    expect(far).toBeNull();
  });
});

describe("buildHoverTooltipLines", () => {
  it("emits expected rows and includes ejection counter text", () => {
    const lines = buildHoverTooltipLines({
      body: makeBodies()[1],
      bodyIndex: 1,
      acceleration: { x: 6, y: 8 },
      ejectMetrics: { energy: 2.5, speedRatioToEscape: 1.2, farCoreRatio: 5.2, outward: true, strongEscape: true },
      ejectionTimeSec: 3.5,
      ejectionThresholdSec: 10,
      isEjected: false,
    });

    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe("Body 2");
    expect(lines[1].startsWith("r: (")).toBe(true);
    expect(lines[2].startsWith("v: (")).toBe(true);
    expect(lines[3].startsWith("a: (")).toBe(true);
    expect(lines[4].startsWith("Erel: ")).toBe(true);
    expect(lines[5].startsWith("v/vesc: ")).toBe(true);
    expect(lines[6]).toContain("out: Y");
    expect(lines[6]).toContain("cnt: 3.5s/10s");
  });
});

describe("buildHoverTooltipSnapshotForBodyIndex", () => {
  it("returns null for missing index and computed tooltip snapshot for valid index", () => {
    const camera = { center: { x: 0, y: 0 }, worldUnitsPerPixel: 1 };
    const viewport = { width: 100, height: 100 };
    const world = makeWorld({
      ejectionCounterById: { "body-2": 11 },
    });
    const params = makeParams();

    const missing = buildHoverTooltipSnapshotForBodyIndex({
      world,
      params,
      camera,
      viewport,
      bodyIndex: 99,
    });
    const valid = buildHoverTooltipSnapshotForBodyIndex({
      world,
      params,
      camera,
      viewport,
      bodyIndex: 1,
      screen: { x: 12, y: 34 },
    });

    expect(missing).toBeNull();
    expect(valid).not.toBeNull();
    expect(valid?.bodyId).toBe("body-2");
    expect(valid?.color).toBe("#0f0");
    expect(valid?.x).toBe(12);
    expect(valid?.y).toBe(34);
    expect(valid?.lines[0]).toBe("Body 2");
    expect(valid?.lines[6]).toContain("cnt: ejected");
  });
});
