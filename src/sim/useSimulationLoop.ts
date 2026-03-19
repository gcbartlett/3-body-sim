import { useEffect, useRef, type RefObject } from "react";
import { drawFrame, fadeAndPruneTrails, type TrailMap } from "../render/canvasRenderer";
import { updateCamera, type Camera } from "./camera";
import { evaluateEjection } from "./ejection";
import { velocityVerletStep } from "./integrators";
import { centerOfMass } from "./physics";
import type { BodyState, SimParams, WorldState } from "./types";

const BASE_MAX_STEPS = 12;
const VIEWPORT_TARGET_FRACTION = 0.66;
const ZOOM_DAMPING_OUT = 0.2;
const ZOOM_DAMPING_IN = 0.0025;
const ZOOM_IN_HYSTERESIS = 0.08;

type Viewport = {
  width: number;
  height: number;
};

type LockMode = "none" | "origin" | "com";

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

      let nextWorld = currentWorld;
      if (currentWorld.isRunning) {
        const rate = currentParams.speed;
        const dtScale =
          rate <= 1
            ? 1
            : Math.min(6, 1 + Math.log10(Math.max(1, rate)) * 2.3);
        const effectiveDt = currentParams.dt * dtScale;
        const maxStepsThisFrame = Math.max(
          BASE_MAX_STEPS,
          Math.min(240, Math.floor(BASE_MAX_STEPS + 20 * Math.sqrt(rate))),
        );
        const trailSampleEvery = Math.max(1, Math.min(45, Math.floor(rate)));
        const stepParams = { ...currentParams, dt: effectiveDt };

        accumulatorRef.current += dtReal * rate;
        let stepCount = 0;
        while (accumulatorRef.current >= effectiveDt && stepCount < maxStepsThisFrame) {
          const steppedBodies = velocityVerletStep(nextWorld.bodies, stepParams);
          simStepCounterRef.current += 1;
          if (simStepCounterRef.current % trailSampleEvery === 0) {
            trailsRef.current = appendTrailPointsRef.current(trailsRef.current, steppedBodies);
          }

          nextWorld = {
            ...nextWorld,
            bodies: steppedBodies,
            elapsedTime: nextWorld.elapsedTime + effectiveDt,
          };
          const ejection = evaluateEjection(nextWorld, stepParams);
          nextWorld = {
            ...nextWorld,
            ejectionCounterById: ejection.ejectionCounterById,
            ejectedBodyId: ejection.ejectedBodyId,
            ejectedBodyIds: ejection.ejectedBodyIds,
            isRunning: ejection.isRunning,
          };
          nextWorld = applyDissolutionProgressRef.current(nextWorld, stepParams, effectiveDt);
          accumulatorRef.current -= effectiveDt;
          stepCount += 1;
          if (!nextWorld.isRunning) {
            break;
          }
        }

        const maxBacklog = effectiveDt * maxStepsThisFrame;
        if (accumulatorRef.current > maxBacklog) {
          accumulatorRef.current = maxBacklog;
        }

        if (nextWorld !== currentWorld) {
          worldRef.current = nextWorld;
          setWorld(nextWorld);
        }
      }

      const com = centerOfMass(worldRef.current.bodies);
      const cam = manualPanZoom
        ? cameraRef.current
        : (() => {
            const trackedCamera = updateCamera(cameraRef.current, worldRef.current.bodies, viewport);
            const targetCenter =
              lockMode === "com"
                ? com
                : lockMode === "origin"
                ? { x: 0, y: 0 }
                : trackedCamera.center;

            const xs = worldRef.current.bodies.map((body) => body.position.x);
            const ys = worldRef.current.bodies.map((body) => body.position.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const spanX = Math.max(0.5, maxX - minX);
            const spanY = Math.max(0.5, maxY - minY);
            const universalRequiredWorldUnitsPerPixel = Math.max(
              0.001,
              spanX / Math.max(1, viewport.width * VIEWPORT_TARGET_FRACTION),
              spanY / Math.max(1, viewport.height * VIEWPORT_TARGET_FRACTION),
            );

            const maxOffsetX = worldRef.current.bodies.reduce(
              (max, body) => Math.max(max, Math.abs(body.position.x - targetCenter.x)),
              0,
            );
            const maxOffsetY = worldRef.current.bodies.reduce(
              (max, body) => Math.max(max, Math.abs(body.position.y - targetCenter.y)),
              0,
            );
            const requiredWorldUnitsPerPixel = Math.max(
              universalRequiredWorldUnitsPerPixel,
              maxOffsetX / Math.max(1, viewport.width * 0.5 * VIEWPORT_TARGET_FRACTION),
              maxOffsetY / Math.max(1, viewport.height * 0.5 * VIEWPORT_TARGET_FRACTION),
            );
            const currentScale = cameraRef.current.worldUnitsPerPixel;
            const needZoomOut = requiredWorldUnitsPerPixel > currentScale;
            const allowZoomIn =
              requiredWorldUnitsPerPixel < currentScale * (1 - ZOOM_IN_HYSTERESIS);
            const targetScale = needZoomOut || allowZoomIn
              ? requiredWorldUnitsPerPixel
              : currentScale;
            const fastZoomInActive = forceFastZoomInFramesRef.current > 0;
            const damping = needZoomOut || fastZoomInActive ? ZOOM_DAMPING_OUT : ZOOM_DAMPING_IN;
            if (forceFastZoomInFramesRef.current > 0) {
              forceFastZoomInFramesRef.current -= 1;
            }
            return {
              ...trackedCamera,
              center: targetCenter,
              worldUnitsPerPixel:
                currentScale + (targetScale - currentScale) * damping,
            };
          })();

      cameraRef.current = cam;
      trailsRef.current = fadeAndPruneTrails(trailsRef.current, currentParams.trailFade);
      drawFrame(ctx, trailsRef.current, worldRef.current.bodies, cam, viewport, {
        showOrigin: showOriginMarker,
        showGrid,
        showCenterOfMass,
        centerOfMass: com,
      });

      if (hoverBodyIdRef.current && time - hoverLastUpdateTimeRef.current >= 1000) {
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
