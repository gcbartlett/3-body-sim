import { describe, expect, it, vi } from "vitest";
import { applySimulationFrameResult } from "~/src/sim/useSimulationLoop";
import type { Camera } from "~/src/sim/camera";
import { createSimulationHistory, getHistorySnapshots, type SimulationHistory } from "~/src/sim/simulationHistory";
import type { WorldState } from "~/src/sim/types";

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: [
    {
      id: "a",
      mass: 1,
      position: { x: 0, y: 0 },
      velocity: { x: 1, y: 0 },
      color: "#f00",
    },
  ],
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

const makeCamera = (overrides: Partial<Camera> = {}): Camera => ({
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
  ...overrides,
});

describe("applySimulationFrameResult", () => {
  it("captures one snapshot before mutating runtime refs when stepsAdvanced > 0", () => {
    const currentWorld = makeWorld({ elapsedTime: 4 });
    const nextWorld = makeWorld({ elapsedTime: 5, isRunning: false });
    const historyRef = {
      current: createSimulationHistory(50) satisfies SimulationHistory,
    };
    const accumulatorRef = { current: 0.2 };
    const trailsRef = { current: { a: [{ x: 1, y: 2, life: 0.9 }] } };
    const simStepCounterRef = { current: 8 };
    const cameraRef = { current: makeCamera() };
    const forceFastZoomInFramesRef = { current: 6 };
    const hoverLastUpdateTimeRef = { current: 100 };
    const worldRef = { current: currentWorld };
    const lastWorldPublishTimeRef = { current: -Infinity };
    const setWorld = vi.fn();

    applySimulationFrameResult({
      frameTime: 100,
      currentWorld,
      frameResult: {
        nextWorld,
        nextAccumulator: 0.7,
        nextTrails: {},
        nextSimStepCounter: 12,
        stepsAdvanced: 3,
        nextCamera: makeCamera({ worldUnitsPerPixel: 0.02 }),
        nextForceFastZoomInFrames: 2,
        nextHoverLastUpdateTime: 200,
        worldChanged: true,
      },
      refs: {
        accumulatorRef: accumulatorRef as never,
        trailsRef: trailsRef as never,
        simStepCounterRef: simStepCounterRef as never,
        cameraRef: cameraRef as never,
        forceFastZoomInFramesRef: forceFastZoomInFramesRef as never,
        hoverLastUpdateTimeRef: hoverLastUpdateTimeRef as never,
        worldRef: worldRef as never,
        lastWorldPublishTimeRef: lastWorldPublishTimeRef as never,
        historyRef: historyRef as never,
      },
      setWorld,
    });

    expect(getHistorySnapshots(historyRef.current)).toHaveLength(1);
    expect(getHistorySnapshots(historyRef.current)[0]).toEqual({
      world: currentWorld,
      trails: { a: [{ x: 1, y: 2, life: 0.9 }] },
      accumulator: 0.2,
      simStepCounter: 8,
      forceFastZoomInFrames: 6,
    });
    expect(accumulatorRef.current).toBe(0.7);
    expect(simStepCounterRef.current).toBe(12);
    expect(forceFastZoomInFramesRef.current).toBe(2);
    expect(hoverLastUpdateTimeRef.current).toBe(200);
    expect(worldRef.current).toBe(nextWorld);
    expect(setWorld).toHaveBeenCalledWith(nextWorld);
  });

  it("does not capture a snapshot when no simulation steps advanced", () => {
    const currentWorld = makeWorld({ elapsedTime: 10 });
    const historyRef = {
      current: createSimulationHistory(50) satisfies SimulationHistory,
    };
    const worldRef = { current: currentWorld };
    const lastWorldPublishTimeRef = { current: -Infinity };
    const setWorld = vi.fn();

    applySimulationFrameResult({
      frameTime: 100,
      currentWorld,
      frameResult: {
        nextWorld: currentWorld,
        nextAccumulator: 0.1,
        nextTrails: {},
        nextSimStepCounter: 1,
        stepsAdvanced: 0,
        nextCamera: makeCamera(),
        nextForceFastZoomInFrames: 0,
        nextHoverLastUpdateTime: 0,
        worldChanged: false,
      },
      refs: {
        accumulatorRef: { current: 0 } as never,
        trailsRef: { current: {} } as never,
        simStepCounterRef: { current: 0 } as never,
        cameraRef: { current: makeCamera() } as never,
        forceFastZoomInFramesRef: { current: 0 } as never,
        hoverLastUpdateTimeRef: { current: 0 } as never,
        worldRef: worldRef as never,
        lastWorldPublishTimeRef: lastWorldPublishTimeRef as never,
        historyRef: historyRef as never,
      },
      setWorld,
    });

    expect(getHistorySnapshots(historyRef.current)).toEqual([]);
    expect(setWorld).not.toHaveBeenCalled();
  });

  it("throttles React world publish while simulation is running", () => {
    const currentWorld = makeWorld({ isRunning: true, elapsedTime: 1 });
    const nextWorld = makeWorld({ isRunning: true, elapsedTime: 2 });
    const worldRef = { current: currentWorld };
    const setWorld = vi.fn();
    const lastWorldPublishTimeRef = { current: 100 };

    applySimulationFrameResult({
      frameTime: 120,
      currentWorld,
      frameResult: {
        nextWorld,
        nextAccumulator: 0,
        nextTrails: {},
        nextSimStepCounter: 0,
        stepsAdvanced: 0,
        nextCamera: makeCamera(),
        nextForceFastZoomInFrames: 0,
        nextHoverLastUpdateTime: 0,
        worldChanged: true,
      },
      refs: {
        accumulatorRef: { current: 0 } as never,
        trailsRef: { current: {} } as never,
        simStepCounterRef: { current: 0 } as never,
        cameraRef: { current: makeCamera() } as never,
        forceFastZoomInFramesRef: { current: 0 } as never,
        hoverLastUpdateTimeRef: { current: 0 } as never,
        worldRef: worldRef as never,
        lastWorldPublishTimeRef: lastWorldPublishTimeRef as never,
        historyRef: { current: createSimulationHistory(50) } as never,
      },
      setWorld,
    });

    expect(worldRef.current).toBe(nextWorld);
    expect(setWorld).not.toHaveBeenCalled();
    expect(lastWorldPublishTimeRef.current).toBe(100);
  });

  it("publishes immediately when run state changes to stopped", () => {
    const currentWorld = makeWorld({ isRunning: true, elapsedTime: 1 });
    const nextWorld = makeWorld({ isRunning: false, elapsedTime: 2 });
    const worldRef = { current: currentWorld };
    const setWorld = vi.fn();
    const lastWorldPublishTimeRef = { current: 100 };

    applySimulationFrameResult({
      frameTime: 120,
      currentWorld,
      frameResult: {
        nextWorld,
        nextAccumulator: 0,
        nextTrails: {},
        nextSimStepCounter: 0,
        stepsAdvanced: 0,
        nextCamera: makeCamera(),
        nextForceFastZoomInFrames: 0,
        nextHoverLastUpdateTime: 0,
        worldChanged: true,
      },
      refs: {
        accumulatorRef: { current: 0 } as never,
        trailsRef: { current: {} } as never,
        simStepCounterRef: { current: 0 } as never,
        cameraRef: { current: makeCamera() } as never,
        forceFastZoomInFramesRef: { current: 0 } as never,
        hoverLastUpdateTimeRef: { current: 0 } as never,
        worldRef: worldRef as never,
        lastWorldPublishTimeRef: lastWorldPublishTimeRef as never,
        historyRef: { current: createSimulationHistory(50) } as never,
      },
      setWorld,
    });

    expect(worldRef.current).toBe(nextWorld);
    expect(setWorld).toHaveBeenCalledWith(nextWorld);
    expect(lastWorldPublishTimeRef.current).toBe(120);
  });

  it("respects a custom running publish interval", () => {
    const currentWorld = makeWorld({ isRunning: true, elapsedTime: 1 });
    const nextWorld = makeWorld({ isRunning: true, elapsedTime: 2 });
    const worldRef = { current: currentWorld };
    const setWorld = vi.fn();
    const lastWorldPublishTimeRef = { current: 100 };

    applySimulationFrameResult({
      frameTime: 220,
      currentWorld,
      frameResult: {
        nextWorld,
        nextAccumulator: 0,
        nextTrails: {},
        nextSimStepCounter: 0,
        stepsAdvanced: 0,
        nextCamera: makeCamera(),
        nextForceFastZoomInFrames: 0,
        nextHoverLastUpdateTime: 0,
        worldChanged: true,
      },
      reactWorldPublishIntervalMs: 200,
      refs: {
        accumulatorRef: { current: 0 } as never,
        trailsRef: { current: {} } as never,
        simStepCounterRef: { current: 0 } as never,
        cameraRef: { current: makeCamera() } as never,
        forceFastZoomInFramesRef: { current: 0 } as never,
        hoverLastUpdateTimeRef: { current: 0 } as never,
        worldRef: worldRef as never,
        lastWorldPublishTimeRef: lastWorldPublishTimeRef as never,
        historyRef: { current: createSimulationHistory(50) } as never,
      },
      setWorld,
    });

    expect(worldRef.current).toBe(nextWorld);
    expect(setWorld).not.toHaveBeenCalled();
    expect(lastWorldPublishTimeRef.current).toBe(100);
  });
});
