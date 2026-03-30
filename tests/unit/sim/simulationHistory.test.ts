import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_STEPS,
  MIN_HISTORY_STEPS,
  clampHistoryMaxSteps,
  captureSnapshot,
  clearHistory,
  cloneWorldState,
  getSimulationHistoryMetrics,
  popSnapshot,
  pushSnapshot,
  restoreSnapshot,
  setHistoryMaxSteps,
  type SimulationHistory,
  type SimulationSnapshot,
} from "~/src/sim/simulationHistory";
import type { WorldState } from "~/src/sim/types";
import type { TrailMap } from "~/src/render/canvasRenderer";

const makeWorld = (): WorldState => ({
  bodies: [
    {
      id: "a",
      mass: 1,
      position: { x: 1, y: 2 },
      velocity: { x: 3, y: 4 },
      color: "#f00",
    },
    {
      id: "b",
      mass: 2,
      position: { x: -1, y: -2 },
      velocity: { x: -3, y: -4 },
      color: "#0f0",
    },
  ],
  elapsedTime: 12.5,
  isRunning: true,
  ejectionCounterById: { a: 3 },
  ejectedBodyId: "a",
  ejectedBodyIds: ["a"],
  dissolutionCounterSec: 2.25,
  dissolutionDetected: true,
  dissolutionJustDetected: false,
});

const makeTrails = (): TrailMap => ({
  a: [
    { x: 1, y: 2, life: 0.9 },
    { x: 2, y: 3, life: 0.5 },
  ],
  b: [{ x: -1, y: -2, life: 0.6 }],
});

const makeSnapshot = (id: string): SimulationSnapshot =>
  captureSnapshot({
    world: {
      ...makeWorld(),
      ejectedBodyId: id,
      ejectedBodyIds: [id],
    },
    trails: makeTrails(),
    accumulator: id.length,
    simStepCounter: id.length * 10,
    forceFastZoomInFrames: id.length * 2,
  });

describe("cloneWorldState", () => {
  it("deep-clones bodies and mutable collections without aliasing references", () => {
    const world = makeWorld();
    const cloned = cloneWorldState(world);

    expect(cloned).toEqual(world);
    expect(cloned).not.toBe(world);
    expect(cloned.bodies).not.toBe(world.bodies);
    expect(cloned.bodies[0]).not.toBe(world.bodies[0]);
    expect(cloned.bodies[0].position).not.toBe(world.bodies[0].position);
    expect(cloned.bodies[0].velocity).not.toBe(world.bodies[0].velocity);
    expect(cloned.ejectionCounterById).not.toBe(world.ejectionCounterById);
    expect(cloned.ejectedBodyIds).not.toBe(world.ejectedBodyIds);

    world.bodies[0].position.x = 999;
    world.ejectionCounterById.a = 999;
    world.ejectedBodyIds.push("b");

    expect(cloned.bodies[0].position.x).toBe(1);
    expect(cloned.ejectionCounterById.a).toBe(3);
    expect(cloned.ejectedBodyIds).toEqual(["a"]);
  });
});

describe("captureSnapshot", () => {
  it("captures a deep-cloned world with scalar simulation metadata", () => {
    const world = makeWorld();
    const snapshot = captureSnapshot({
      world,
      trails: makeTrails(),
      accumulator: 0.75,
      simStepCounter: 25,
      forceFastZoomInFrames: 8,
    });

    expect(snapshot.world).toEqual(world);
    expect(snapshot.world).not.toBe(world);
    expect(snapshot.accumulator).toBe(0.75);
    expect(snapshot.simStepCounter).toBe(25);
    expect(snapshot.forceFastZoomInFrames).toBe(8);
    expect(snapshot.trails).toEqual(makeTrails());

    world.bodies[0].velocity.y = 123;
    snapshot.trails.a[0].x = 123;
    expect(snapshot.world.bodies[0].velocity.y).toBe(4);
    expect(makeTrails().a[0].x).toBe(1);
  });
});

describe("history helpers", () => {
  const makeHistoryRef = (maxSteps: number): { current: SimulationHistory } => ({
    current: { snapshots: [], maxSteps },
  });

  it("pushes and pops in LIFO order", () => {
    const historyRef = makeHistoryRef(5);
    const first = makeSnapshot("first");
    const second = makeSnapshot("second");

    pushSnapshot(historyRef, first);
    pushSnapshot(historyRef, second);

    expect(popSnapshot(historyRef)).toBe(second);
    expect(popSnapshot(historyRef)).toBe(first);
    expect(popSnapshot(historyRef)).toBeNull();
  });

  it("evicts the oldest snapshot when capacity is exceeded", () => {
    const historyRef = makeHistoryRef(2);
    const first = makeSnapshot("first");
    const second = makeSnapshot("second");
    const third = makeSnapshot("third");

    pushSnapshot(historyRef, first);
    pushSnapshot(historyRef, second);
    pushSnapshot(historyRef, third);

    expect(historyRef.current.snapshots).toEqual([second, third]);
  });

  it("clears all stored snapshots", () => {
    const historyRef = makeHistoryRef(3);
    pushSnapshot(historyRef, makeSnapshot("one"));
    pushSnapshot(historyRef, makeSnapshot("two"));

    clearHistory(historyRef);

    expect(historyRef.current.snapshots).toEqual([]);
    expect(popSnapshot(historyRef)).toBeNull();
  });
});

describe("restoreSnapshot", () => {
  it("returns restored world/scalars and enforces paused state", () => {
    const snapshot = captureSnapshot({
      world: {
        ...makeWorld(),
        isRunning: true,
      },
      trails: makeTrails(),
      accumulator: 1.25,
      simStepCounter: 40,
      forceFastZoomInFrames: 7,
    });
    const restored = restoreSnapshot({
      snapshot,
    });

    expect(restored.world).toEqual({ ...snapshot.world, isRunning: false });
    expect(restored.world.isRunning).toBe(false);
    expect(restored.accumulator).toBe(1.25);
    expect(restored.simStepCounter).toBe(40);
    expect(restored.forceFastZoomInFrames).toBe(7);
    expect(restored.trails).toEqual(makeTrails());
  });

  it("does not alias restored world to the stored snapshot and keeps snapshot unchanged", () => {
    const snapshot = makeSnapshot("snapshot");
    const originalSnapshotWorld = cloneWorldState(snapshot.world);
    const restored = restoreSnapshot({
      snapshot,
    });

    expect(restored.world).not.toBe(snapshot.world);
    expect(restored.world.bodies).not.toBe(snapshot.world.bodies);
    expect(restored.world.bodies[0]).not.toBe(snapshot.world.bodies[0]);

    restored.world.bodies[0].position.x = 1234;
    restored.trails.a[0].x = 4321;
    expect(snapshot.world.bodies[0].position.x).toBe(1);
    expect(snapshot.world).toEqual(originalSnapshotWorld);
    expect(snapshot.trails.a[0].x).toBe(1);
  });
});

describe("history depth configuration and metrics", () => {
  it("clamps history depth to supported range", () => {
    expect(clampHistoryMaxSteps(-5)).toBe(MIN_HISTORY_STEPS);
    expect(clampHistoryMaxSteps(10_000)).toBe(MAX_HISTORY_STEPS);
    expect(clampHistoryMaxSteps(300)).toBe(300);
  });

  it("applies max-step changes immediately and trims oldest snapshots on shrink", () => {
    const snapshots = Array.from({ length: 80 }, (_, index) => makeSnapshot(`s${index}`));
    const expectedFirstRetainedId = snapshots[30].world.ejectedBodyId;
    const historyRef: { current: SimulationHistory } = {
      current: {
        snapshots,
        maxSteps: 300,
      },
    };

    setHistoryMaxSteps(historyRef, 50);
    expect(historyRef.current.maxSteps).toBe(50);
    expect(historyRef.current.snapshots).toHaveLength(50);
    expect(historyRef.current.snapshots[0].world.ejectedBodyId).toBe(expectedFirstRetainedId);

    setHistoryMaxSteps(historyRef, 2_000);
    expect(historyRef.current.maxSteps).toBe(2000);
    expect(historyRef.current.snapshots).toHaveLength(50);
  });

  it("keeps estimated bytes correct when trimming with uninitialized cached bytes", () => {
    const snapshots = Array.from({ length: 80 }, (_, index) => makeSnapshot(`s${index}`));
    const historyRef: { current: SimulationHistory } = {
      current: {
        snapshots,
        maxSteps: 300,
      },
    };

    setHistoryMaxSteps(historyRef, 50);

    const metrics = getSimulationHistoryMetrics(historyRef.current);
    expect(metrics.count).toBe(50);
    expect(metrics.estimatedBytes).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.estimatedBytes)).toBe(true);
  });

  it("reports bounded history metrics with estimated bytes", () => {
    const metrics = getSimulationHistoryMetrics({
      snapshots: [makeSnapshot("alpha"), makeSnapshot("beta")],
      maxSteps: 300,
    });

    expect(metrics.count).toBe(2);
    expect(metrics.maxSteps).toBe(300);
    expect(metrics.estimatedBytes).toBeGreaterThan(0);
  });

  it("maintains estimated-byte metrics incrementally across mutations", () => {
    const historyRef: { current: SimulationHistory } = {
      current: {
        snapshots: [],
        maxSteps: 2,
      },
    };
    const first = makeSnapshot("first");
    const second = makeSnapshot("second");
    const third = makeSnapshot("third");

    pushSnapshot(historyRef, first);
    const afterFirst = getSimulationHistoryMetrics(historyRef.current);
    pushSnapshot(historyRef, second);
    const afterSecond = getSimulationHistoryMetrics(historyRef.current);
    pushSnapshot(historyRef, third);
    const afterThird = getSimulationHistoryMetrics(historyRef.current);

    expect(afterFirst.count).toBe(1);
    expect(afterSecond.count).toBe(2);
    expect(afterThird.count).toBe(2);
    expect(afterSecond.estimatedBytes).toBeGreaterThan(afterFirst.estimatedBytes);
    expect(afterThird.estimatedBytes).toBeGreaterThan(0);

    popSnapshot(historyRef);
    const afterPop = getSimulationHistoryMetrics(historyRef.current);
    expect(afterPop.count).toBe(1);
    expect(afterPop.estimatedBytes).toBeLessThan(afterThird.estimatedBytes);

    clearHistory(historyRef);
    const afterClear = getSimulationHistoryMetrics(historyRef.current);
    expect(afterClear.count).toBe(0);
    expect(afterClear.estimatedBytes).toBe(0);
  });
});
