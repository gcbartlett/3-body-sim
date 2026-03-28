import { describe, expect, it } from "vitest";
import {
  captureSnapshot,
  clearHistory,
  cloneWorldState,
  popSnapshot,
  pushSnapshot,
  restoreSnapshot,
  type SimulationHistory,
  type SimulationSnapshot,
} from "~/src/sim/simulationHistory";
import type { WorldState } from "~/src/sim/types";

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

const makeSnapshot = (id: string): SimulationSnapshot =>
  captureSnapshot({
    world: {
      ...makeWorld(),
      ejectedBodyId: id,
      ejectedBodyIds: [id],
    },
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
      accumulator: 0.75,
      simStepCounter: 25,
      forceFastZoomInFrames: 8,
    });

    expect(snapshot.world).toEqual(world);
    expect(snapshot.world).not.toBe(world);
    expect(snapshot.accumulator).toBe(0.75);
    expect(snapshot.simStepCounter).toBe(25);
    expect(snapshot.forceFastZoomInFrames).toBe(8);

    world.bodies[0].velocity.y = 123;
    expect(snapshot.world.bodies[0].velocity.y).toBe(4);
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
    expect(snapshot.world.bodies[0].position.x).toBe(1);
    expect(snapshot.world).toEqual(originalSnapshotWorld);
  });
});
