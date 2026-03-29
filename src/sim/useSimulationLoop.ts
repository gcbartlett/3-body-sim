import { useEffect, useEffectEvent, type RefObject } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import { type Camera } from "./camera";
import {
  captureSnapshot,
  pushSnapshot,
  type SimulationHistory,
} from "./simulationHistory";
import { runSimulationFrame, type SimulationFrameResult } from "./simulationFrame";
import type { LockMode, SimParams, WorldState } from "./types";
import { perfMonitor } from "../perf/perfMonitor";

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
    historyRef: RefObject<SimulationHistory>;
    onHistoryChanged?: (depth: number) => void;
  };
  hover: {
    hoverBodyIdRef: RefObject<string | null>;
    hoverLastUpdateTimeRef: RefObject<number>;
    refreshHoverTooltipForBodyId: (bodyId: string) => void;
  };
  setWorld: (world: WorldState) => void;
};

type ApplySimulationFrameResultArgs = {
  currentWorld: WorldState;
  frameResult: SimulationFrameResult;
  refs: {
    accumulatorRef: RefObject<number>;
    trailsRef: RefObject<TrailMap>;
    simStepCounterRef: RefObject<number>;
    cameraRef: RefObject<Camera>;
    forceFastZoomInFramesRef: RefObject<number>;
    hoverLastUpdateTimeRef: RefObject<number>;
    worldRef: RefObject<WorldState>;
    historyRef: RefObject<SimulationHistory>;
    onHistoryChanged?: (depth: number) => void;
  };
  setWorld: (world: WorldState) => void;
};

export const applySimulationFrameResult = ({
  currentWorld,
  frameResult,
  refs: {
    accumulatorRef,
    trailsRef,
    simStepCounterRef,
    cameraRef,
    forceFastZoomInFramesRef,
    hoverLastUpdateTimeRef,
    worldRef,
    historyRef,
    onHistoryChanged,
  },
  setWorld,
}: ApplySimulationFrameResultArgs): void => {
  if (frameResult.stepsAdvanced > 0) {
    perfMonitor.measure("history.captureAndPush", () => {
      pushSnapshot(
        historyRef,
        captureSnapshot({
          world: currentWorld,
          trails: trailsRef.current,
          accumulator: accumulatorRef.current,
          simStepCounter: simStepCounterRef.current,
          forceFastZoomInFrames: forceFastZoomInFramesRef.current,
        }),
      );
    });
    onHistoryChanged?.(historyRef.current.snapshots.length);
    perfMonitor.incrementCounter("history.onHistoryChanged.calls");
  }
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
    historyRef,
    onHistoryChanged,
  },
  hover: { hoverBodyIdRef, hoverLastUpdateTimeRef, refreshHoverTooltipForBodyId },
  setWorld,
}: UseSimulationLoopArgs): void => {
  const onHoverRefreshEvent = useEffectEvent((bodyId: string) => {
    refreshHoverTooltipForBodyId(bodyId);
  });

  useEffect(() => {
    const tick = (time: number) => {
      const frameStart = performance.now();
      const canvas = canvasRef.current;
      if (!canvas) {
        perfMonitor.incrementCounter("raf.skip.noCanvas");
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        perfMonitor.incrementCounter("raf.skip.noContext");
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
      applySimulationFrameResult({
        currentWorld,
        frameResult,
        refs: {
          accumulatorRef,
          trailsRef,
          simStepCounterRef,
          cameraRef,
          forceFastZoomInFramesRef,
          hoverLastUpdateTimeRef,
          worldRef,
          historyRef,
          onHistoryChanged,
        },
        setWorld,
      });
      perfMonitor.recordDuration("raf.tick.total", performance.now() - frameStart);
      perfMonitor.incrementCounter("raf.tick.calls");

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
