import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Camera } from "~/src/sim/camera";
import type { TrailMap } from "~/src/render/canvasRenderer";
import type { SimParams, WorldState } from "~/src/sim/types";

vi.mock("~/src/render/canvasRenderer", () => ({
  drawFrame: vi.fn(),
  fadeAndPruneTrails: vi.fn((trails: TrailMap) => trails),
}));

vi.mock("~/src/sim/simulationTick", () => ({
  advanceRunningWorldStep: vi.fn(),
}));

vi.mock("~/src/sim/cameraPolicy", () => ({
  computeAutoCamera: vi.fn(),
}));

vi.mock("~/src/sim/physics", () => ({
  centerOfMass: vi.fn(() => ({ x: 0, y: 0 })),
}));

import { drawFrame, fadeAndPruneTrails } from "~/src/render/canvasRenderer";
import { computeAutoCamera } from "~/src/sim/cameraPolicy";
import { centerOfMass } from "~/src/sim/physics";
import { runSimulationFrame } from "~/src/sim/simulationFrame";
import { advanceRunningWorldStep } from "~/src/sim/simulationTick";

const makeWorld = (overrides: Partial<WorldState> = {}): WorldState => ({
  bodies: [],
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

const params: SimParams = {
  G: 1,
  dt: 0.01,
  speed: 1,
  softening: 0.001,
  trailFade: 0.02,
};

const camera: Camera = {
  center: { x: 0, y: 0 },
  worldUnitsPerPixel: 0.01,
};

describe("runSimulationFrame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(advanceRunningWorldStep).mockReturnValue({
      nextWorld: makeWorld({ elapsedTime: 1 }),
      nextAccumulator: 0.25,
      nextTrails: {},
      nextSimStepCounter: 3,
      stepsAdvanced: 1,
      worldChanged: true,
    });
    vi.mocked(computeAutoCamera).mockReturnValue({
      camera: {
        center: { x: 2, y: 3 },
        worldUnitsPerPixel: 0.02,
      },
      nextForceFastZoomInFrames: 11,
    });
  });

  it("delegates stepping with dtReal and applies auto-camera/render pipeline", () => {
    const onHoverRefresh = vi.fn();
    const result = runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 5000,
      dtReal: 0.5,
      viewport: { width: 1000, height: 800 },
      runtime: {
        lockMode: "none",
        manualPanZoom: false,
        showOriginMarker: true,
        showGrid: true,
        showCenterOfMass: true,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.1,
        simStepCounter: 2,
        forceFastZoomInFrames: 12,
      },
      hover: {
        hoverBodyId: "body-1",
        hoverLastUpdateTime: 3500,
        onHoverRefresh,
      },
    });

    expect(advanceRunningWorldStep).toHaveBeenCalledWith(
      expect.objectContaining({ dtReal: 0.5, accumulator: 0.1 }),
    );
    expect(computeAutoCamera).toHaveBeenCalledTimes(1);
    expect(fadeAndPruneTrails).toHaveBeenCalledWith({}, 0.02);
    expect(drawFrame).toHaveBeenCalledTimes(1);
    expect(onHoverRefresh).toHaveBeenCalledWith("body-1", 5000);
    expect(result.nextCamera).toEqual({ center: { x: 2, y: 3 }, worldUnitsPerPixel: 0.02 });
    expect(result.nextForceFastZoomInFrames).toBe(11);
    expect(result.nextHoverLastUpdateTime).toBe(5000);
    expect(centerOfMass).toHaveBeenCalledTimes(1);
  });

  it("keeps manual camera state and skips hover refresh before interval", () => {
    const onHoverRefresh = vi.fn();
    const result = runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 4200,
      dtReal: 0.2,
      viewport: { width: 1000, height: 800 },
      runtime: {
        lockMode: "com",
        manualPanZoom: true,
        showOriginMarker: false,
        showGrid: false,
        showCenterOfMass: false,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.4,
        simStepCounter: 4,
        forceFastZoomInFrames: 9,
      },
      hover: {
        hoverBodyId: "body-2",
        hoverLastUpdateTime: 3501,
        onHoverRefresh,
      },
    });

    expect(computeAutoCamera).not.toHaveBeenCalled();
    expect(result.nextCamera).toBe(camera);
    expect(result.nextForceFastZoomInFrames).toBe(9);
    expect(onHoverRefresh).not.toHaveBeenCalled();
    expect(result.nextHoverLastUpdateTime).toBe(3501);
  });

  it("refreshes hover exactly at the interval boundary", () => {
    const onHoverRefresh = vi.fn();
    const result = runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 4500,
      dtReal: 0.1,
      viewport: { width: 1000, height: 800 },
      runtime: {
        lockMode: "none",
        manualPanZoom: false,
        showOriginMarker: false,
        showGrid: false,
        showCenterOfMass: false,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.2,
        simStepCounter: 1,
        forceFastZoomInFrames: 5,
      },
      hover: {
        hoverBodyId: "body-3",
        hoverLastUpdateTime: 3500,
        onHoverRefresh,
      },
    });

    expect(onHoverRefresh).toHaveBeenCalledWith("body-3", 4500);
    expect(result.nextHoverLastUpdateTime).toBe(4500);
  });

  it("does not refresh hover when hoverBodyId is null even after interval", () => {
    const onHoverRefresh = vi.fn();
    const result = runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 10000,
      dtReal: 0.1,
      viewport: { width: 1000, height: 800 },
      runtime: {
        lockMode: "none",
        manualPanZoom: false,
        showOriginMarker: false,
        showGrid: false,
        showCenterOfMass: false,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.2,
        simStepCounter: 1,
        forceFastZoomInFrames: 5,
      },
      hover: {
        hoverBodyId: null,
        hoverLastUpdateTime: 0,
        onHoverRefresh,
      },
    });

    expect(onHoverRefresh).not.toHaveBeenCalled();
    expect(result.nextHoverLastUpdateTime).toBe(0);
  });

  it("propagates unchanged step outputs including worldChanged=false", () => {
    const steppedWorld = makeWorld({ elapsedTime: 2, isRunning: false });
    vi.mocked(advanceRunningWorldStep).mockReturnValue({
      nextWorld: steppedWorld,
      nextAccumulator: 0.75,
      nextTrails: { "body-1": [{ x: 1, y: 2, life: 0.5 }] },
      nextSimStepCounter: 42,
      stepsAdvanced: 0,
      worldChanged: false,
    });

    const result = runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 2000,
      dtReal: 0.1,
      viewport: { width: 1000, height: 800 },
      runtime: {
        lockMode: "origin",
        manualPanZoom: true,
        showOriginMarker: false,
        showGrid: false,
        showCenterOfMass: false,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.01,
        simStepCounter: 7,
        forceFastZoomInFrames: 0,
      },
      hover: {
        hoverBodyId: null,
        hoverLastUpdateTime: 0,
        onHoverRefresh: vi.fn(),
      },
    });

    expect(result.nextWorld).toBe(steppedWorld);
    expect(result.nextAccumulator).toBe(0.75);
    expect(fadeAndPruneTrails).not.toHaveBeenCalled();
    expect(result.nextSimStepCounter).toBe(42);
    expect(result.worldChanged).toBe(false);
  });

  it("passes post-step COM and runtime flags to drawFrame", () => {
    const steppedBodies = [
      {
        id: "body-1",
        mass: 1,
        color: "#fff",
        position: { x: 3, y: 4 },
        velocity: { x: 0, y: 0 },
      },
    ];
    const com = { x: 9, y: -2 };
    vi.mocked(advanceRunningWorldStep).mockReturnValue({
      nextWorld: makeWorld({ bodies: steppedBodies }),
      nextAccumulator: 0.3,
      nextTrails: {},
      nextSimStepCounter: 8,
      stepsAdvanced: 1,
      worldChanged: true,
    });
    vi.mocked(centerOfMass).mockReturnValue(com);

    runSimulationFrame({
      ctx: {} as CanvasRenderingContext2D,
      time: 3000,
      dtReal: 0.1,
      viewport: { width: 640, height: 480 },
      runtime: {
        lockMode: "none",
        manualPanZoom: true,
        showOriginMarker: true,
        showGrid: false,
        showCenterOfMass: true,
      },
      frameState: {
        world: makeWorld(),
        params,
        camera,
        trails: {},
        accumulator: 0.2,
        simStepCounter: 2,
        forceFastZoomInFrames: 1,
      },
      hover: {
        hoverBodyId: null,
        hoverLastUpdateTime: 0,
        onHoverRefresh: vi.fn(),
      },
    });

    expect(centerOfMass).toHaveBeenCalledWith(steppedBodies);
    expect(drawFrame).toHaveBeenCalledWith(
      expect.anything(),
      {},
      steppedBodies,
      camera,
      { width: 640, height: 480 },
      {
        showOrigin: true,
        showGrid: false,
        showCenterOfMass: true,
        centerOfMass: com,
      },
    );
  });
});
