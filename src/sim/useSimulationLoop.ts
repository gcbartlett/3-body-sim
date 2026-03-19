import { useEffect, useRef, type RefObject } from "react";
import { drawFrame, fadeAndPruneTrails, type TrailMap } from "../render/canvasRenderer";
import { type Camera } from "./camera";
import { type LockMode, computeAutoCamera } from "./cameraPolicy";
import { centerOfMass } from "./physics";
import { advanceRunningWorldStep } from "./simulationTick";
import type { BodyState, SimParams, WorldState } from "./types";

const HOVER_REFRESH_INTERVAL_MS = 1000;

type Viewport = {
  width: number;
  height: number;
};

type UseSimulationLoopArgs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewport: Viewport;
  lockMode: LockMode;
  manualPanZoom: boolean;
  showOriginMarker: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  worldRef: RefObject<WorldState>;
  paramsRef: RefObject<SimParams>;
  cameraRef: RefObject<Camera>;
  trailsRef: RefObject<TrailMap>;
  rafRef: RefObject<number | null>;
  lastTimeRef: RefObject<number | null>;
  accumulatorRef: RefObject<number>;
  forceFastZoomInFramesRef: RefObject<number>;
  simStepCounterRef: RefObject<number>;
  hoverBodyIdRef: RefObject<string | null>;
  hoverLastUpdateTimeRef: RefObject<number>;
  setWorld: (world: WorldState) => void;
  appendTrailPoints: (trails: TrailMap, bodies: BodyState[]) => TrailMap;
  applyDissolutionProgress: (world: WorldState, params: SimParams, dt: number) => WorldState;
  refreshHoverTooltipForBodyId: (bodyId: string) => void;
};

export const useSimulationLoop = ({
  canvasRef,
  viewport,
  lockMode,
  manualPanZoom,
  showOriginMarker,
  showGrid,
  showCenterOfMass,
  worldRef,
  paramsRef,
  cameraRef,
  trailsRef,
  rafRef,
  lastTimeRef,
  accumulatorRef,
  forceFastZoomInFramesRef,
  simStepCounterRef,
  hoverBodyIdRef,
  hoverLastUpdateTimeRef,
  setWorld,
  appendTrailPoints,
  applyDissolutionProgress,
  refreshHoverTooltipForBodyId,
}: UseSimulationLoopArgs): void => {
  const appendTrailPointsRef = useRef(appendTrailPoints);
  const applyDissolutionProgressRef = useRef(applyDissolutionProgress);
  const refreshHoverTooltipForBodyIdRef = useRef(refreshHoverTooltipForBodyId);

  useEffect(() => {
    appendTrailPointsRef.current = appendTrailPoints;
  }, [appendTrailPoints]);

  useEffect(() => {
    applyDissolutionProgressRef.current = applyDissolutionProgress;
  }, [applyDissolutionProgress]);

  useEffect(() => {
    refreshHoverTooltipForBodyIdRef.current = refreshHoverTooltipForBodyId;
  }, [refreshHoverTooltipForBodyId]);

  useEffect(() => {
    const tick = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const currentWorld = worldRef.current;
      const currentParams = paramsRef.current;
      const previous = lastTimeRef.current ?? time;
      const dtReal = (time - previous) / 1000;
      lastTimeRef.current = time;

      const stepResult = advanceRunningWorldStep({
        currentWorld,
        currentParams,
        dtReal,
        accumulator: accumulatorRef.current,
        trails: trailsRef.current,
        simStepCounter: simStepCounterRef.current,
        appendTrailPoints: appendTrailPointsRef.current,
        applyDissolutionProgress: applyDissolutionProgressRef.current,
      });
      accumulatorRef.current = stepResult.nextAccumulator;
      trailsRef.current = stepResult.nextTrails;
      simStepCounterRef.current = stepResult.nextSimStepCounter;
      if (stepResult.worldChanged) {
        worldRef.current = stepResult.nextWorld;
        setWorld(stepResult.nextWorld);
      }

      const com = centerOfMass(worldRef.current.bodies);
      const cam = manualPanZoom
        ? cameraRef.current
        : (() => {
            const autoCameraResult = computeAutoCamera({
              camera: cameraRef.current,
              bodies: worldRef.current.bodies,
              viewport,
              lockMode,
              forceFastZoomInFrames: forceFastZoomInFramesRef.current,
            });
            forceFastZoomInFramesRef.current = autoCameraResult.nextForceFastZoomInFrames;
            return autoCameraResult.camera;
          })();

      cameraRef.current = cam;
      trailsRef.current = fadeAndPruneTrails(trailsRef.current, currentParams.trailFade);
      drawFrame(ctx, trailsRef.current, worldRef.current.bodies, cam, viewport, {
        showOrigin: showOriginMarker,
        showGrid,
        showCenterOfMass,
        centerOfMass: com,
      });

      if (
        hoverBodyIdRef.current &&
        time - hoverLastUpdateTimeRef.current >= HOVER_REFRESH_INTERVAL_MS
      ) {
        refreshHoverTooltipForBodyIdRef.current(hoverBodyIdRef.current);
        hoverLastUpdateTimeRef.current = time;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    cameraRef,
    canvasRef,
    lockMode,
    manualPanZoom,
    paramsRef,
    rafRef,
    showCenterOfMass,
    showGrid,
    showOriginMarker,
    viewport,
    worldRef,
    accumulatorRef,
    forceFastZoomInFramesRef,
    hoverBodyIdRef,
    hoverLastUpdateTimeRef,
    lastTimeRef,
    setWorld,
    simStepCounterRef,
    trailsRef,
  ]);
};
