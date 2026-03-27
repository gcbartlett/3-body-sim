import { useEffect, useEffectEvent, type RefObject } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import { type Camera } from "./camera";
import { runSimulationFrame } from "./simulationFrame";
import type { LockMode, SimParams, WorldState } from "./types";

type Viewport = {
  width: number;
  height: number;
};

type UseSimulationLoopArgs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewport: Viewport;
  runtime: {
    lockMode: LockMode;
    manualPanZoom: boolean;
    showOriginMarker: boolean;
    showGrid: boolean;
    showCenterOfMass: boolean;
  };
  refs: {
    worldRef: RefObject<WorldState>;
    paramsRef: RefObject<SimParams>;
    cameraRef: RefObject<Camera>;
    trailsRef: RefObject<TrailMap>;
    rafRef: RefObject<number | null>;
    lastTimeRef: RefObject<number | null>;
    accumulatorRef: RefObject<number>;
    forceFastZoomInFramesRef: RefObject<number>;
    simStepCounterRef: RefObject<number>;
  };
  hover: {
    hoverBodyIdRef: RefObject<string | null>;
    hoverLastUpdateTimeRef: RefObject<number>;
    refreshHoverTooltipForBodyId: (bodyId: string) => void;
  };
  setWorld: (world: WorldState) => void;
};

export const useSimulationLoop = ({
  canvasRef,
  viewport,
  runtime: { lockMode, manualPanZoom, showOriginMarker, showGrid, showCenterOfMass },
  refs: {
    worldRef,
    paramsRef,
    cameraRef,
    trailsRef,
    rafRef,
    lastTimeRef,
    accumulatorRef,
    forceFastZoomInFramesRef,
    simStepCounterRef,
  },
  hover: { hoverBodyIdRef, hoverLastUpdateTimeRef, refreshHoverTooltipForBodyId },
  setWorld,
}: UseSimulationLoopArgs): void => {
  const onHoverRefreshEvent = useEffectEvent((bodyId: string) => {
    refreshHoverTooltipForBodyId(bodyId);
  });

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

      const frameResult = runSimulationFrame({
        ctx,
        time,
        dtReal,
        viewport,
        runtime: {
          lockMode,
          manualPanZoom,
          showOriginMarker,
          showGrid,
          showCenterOfMass,
        },
        frameState: {
          world: currentWorld,
          params: currentParams,
          camera: cameraRef.current,
          trails: trailsRef.current,
          accumulator: accumulatorRef.current,
          simStepCounter: simStepCounterRef.current,
          forceFastZoomInFrames: forceFastZoomInFramesRef.current,
        },
        hover: {
          hoverBodyId: hoverBodyIdRef.current,
          hoverLastUpdateTime: hoverLastUpdateTimeRef.current,
          onHoverRefresh: onHoverRefreshEvent,
        },
      });
      accumulatorRef.current = frameResult.nextAccumulator;
      trailsRef.current = frameResult.nextTrails;
      simStepCounterRef.current = frameResult.nextSimStepCounter;
      cameraRef.current = frameResult.nextCamera;
      forceFastZoomInFramesRef.current = frameResult.nextForceFastZoomInFrames;
      hoverLastUpdateTimeRef.current = frameResult.nextHoverLastUpdateTime;
      if (frameResult.worldChanged) {
        worldRef.current = frameResult.nextWorld;
        setWorld(frameResult.nextWorld);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- RefObject params are stable identities; effect should react only to runtime flags/viewport/setWorld.
  }, [
    lockMode,
    manualPanZoom,
    showCenterOfMass,
    showGrid,
    showOriginMarker,
    viewport,
    setWorld,
  ]);
};
