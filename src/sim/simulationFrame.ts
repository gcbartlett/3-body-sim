import { drawFrame, fadeAndPruneTrails, type TrailMap } from "../render/canvasRenderer";
import { computeAutoCamera } from "./cameraPolicy";
import { centerOfMass } from "./physics";
import { appendTrailPoints, applyDissolutionProgress } from "./simulationPolicies";
import { advanceRunningWorldStep } from "./simulationTick";
import type { LockMode, SimParams, WorldState } from "./types";
import type { Camera } from "./camera";
import { perfMonitor } from "../perf/perfMonitor";

const HOVER_REFRESH_INTERVAL_MS = 1000;

type Viewport = {
  width: number;
  height: number;
};

type SimulationFrameArgs = {
  ctx: CanvasRenderingContext2D;
  time: number;
  dtReal: number;
  viewport: Viewport;
  runtime: {
    lockMode: LockMode;
    manualPanZoom: boolean;
    showOriginMarker: boolean;
    showGrid: boolean;
    showCenterOfMass: boolean;
  };
  frameState: {
    world: WorldState;
    params: SimParams;
    camera: Camera;
    trails: TrailMap;
    accumulator: number;
    simStepCounter: number;
    forceFastZoomInFrames: number;
  };
  hover: {
    hoverBodyId: string | null;
    hoverLastUpdateTime: number;
    onHoverRefresh: (bodyId: string, time: number) => void;
  };
};

export type SimulationFrameResult = {
  nextWorld: WorldState;
  nextAccumulator: number;
  nextTrails: TrailMap;
  nextSimStepCounter: number;
  stepsAdvanced: number;
  nextCamera: Camera;
  nextForceFastZoomInFrames: number;
  nextHoverLastUpdateTime: number;
  worldChanged: boolean;
};

export const runSimulationFrame = ({
  ctx,
  time,
  dtReal,
  viewport,
  runtime,
  frameState,
  hover,
}: SimulationFrameArgs): SimulationFrameResult => {
  const stepResult = perfMonitor.measure("sim.step", () =>
    advanceRunningWorldStep({
      currentWorld: frameState.world,
      currentParams: frameState.params,
      dtReal,
      accumulator: frameState.accumulator,
      trails: frameState.trails,
      simStepCounter: frameState.simStepCounter,
      appendTrailPoints,
      applyDissolutionProgress,
    }),
  );
  perfMonitor.recordGauge("sim.stepsAdvanced", stepResult.stepsAdvanced);

  const worldAfterStep = stepResult.nextWorld;
  const { com, nextCamera, nextForceFastZoomInFrames } = perfMonitor.measure("sim.camera", () => {
    const nextCom = centerOfMass(worldAfterStep.bodies);
    let computedCamera = frameState.camera;
    let forceFastZoomInFrames = frameState.forceFastZoomInFrames;
    if (!runtime.manualPanZoom) {
      const autoCamera = computeAutoCamera({
        camera: frameState.camera,
        bodies: worldAfterStep.bodies,
        viewport,
        lockMode: runtime.lockMode,
        forceFastZoomInFrames: frameState.forceFastZoomInFrames,
      });
      computedCamera = autoCamera.camera;
      forceFastZoomInFrames = autoCamera.nextForceFastZoomInFrames;
    }
    return {
      com: nextCom,
      nextCamera: computedCamera,
      nextForceFastZoomInFrames: forceFastZoomInFrames,
    };
  });

  const nextTrails = perfMonitor.measure("sim.trails.fadePrune", () =>
    stepResult.stepsAdvanced > 0
      ? fadeAndPruneTrails(stepResult.nextTrails, frameState.params.trailFade)
      : stepResult.nextTrails,
  );
  perfMonitor.measure("render.drawFrame", () => {
    drawFrame(ctx, nextTrails, worldAfterStep.bodies, nextCamera, viewport, {
      showOrigin: runtime.showOriginMarker,
      showGrid: runtime.showGrid,
      showCenterOfMass: runtime.showCenterOfMass,
      centerOfMass: com,
    });
  });

  let nextHoverLastUpdateTime = hover.hoverLastUpdateTime;
  if (hover.hoverBodyId && time - hover.hoverLastUpdateTime >= HOVER_REFRESH_INTERVAL_MS) {
    const bodyId = hover.hoverBodyId;
    perfMonitor.measure("hover.refresh", () => {
      hover.onHoverRefresh(bodyId, time);
    });
    nextHoverLastUpdateTime = time;
    perfMonitor.incrementCounter("hover.refresh.calls");
  }

  return {
    nextWorld: worldAfterStep,
    nextAccumulator: stepResult.nextAccumulator,
    nextTrails,
    nextSimStepCounter: stepResult.nextSimStepCounter,
    stepsAdvanced: stepResult.stepsAdvanced,
    nextCamera,
    nextForceFastZoomInFrames,
    nextHoverLastUpdateTime,
    worldChanged: stepResult.worldChanged,
  };
};
