import { useCallback, useEffect, useEffectEvent, useRef, type RefObject } from "react";
// noinspection ES6PreferShortImport
import type { TrailMap } from "../render/canvasRenderer";
import { type Camera } from "./camera";
import {
  captureSnapshot,
  getHistorySnapshotCount,
  pushSnapshot,
  type SimulationHistory,
} from "./simulationHistory";
import { runSimulationFrame, type SimulationFrameResult } from "./simulationFrame";
import type { LockMode, SimParams, WorldState } from "./types";
import { perfMonitor } from "../perf/perfMonitor";

const DEFAULT_REACT_WORLD_PUBLISH_HZ = 15;
const DEFAULT_REACT_WORLD_PUBLISH_INTERVAL_MS = 1000 / DEFAULT_REACT_WORLD_PUBLISH_HZ;

type Viewport = {
  width: number;
  height: number;
};

type UseSimulationLoopArgs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewport: Viewport;
  runtime: {
    isRunning: boolean;
    lockMode: LockMode;
    manualPanZoom: boolean;
    showOriginMarker: boolean;
    showGrid: boolean;
    showCenterOfMass: boolean;
    reactWorldPublishIntervalMs?: number;
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
  frameTime: number;
  currentWorld: WorldState;
  frameResult: SimulationFrameResult;
  reactWorldPublishIntervalMs?: number;
  refs: {
    accumulatorRef: RefObject<number>;
    trailsRef: RefObject<TrailMap>;
    simStepCounterRef: RefObject<number>;
    cameraRef: RefObject<Camera>;
    forceFastZoomInFramesRef: RefObject<number>;
    hoverLastUpdateTimeRef: RefObject<number>;
    worldRef: RefObject<WorldState>;
    lastWorldPublishTimeRef: RefObject<number>;
    historyRef: RefObject<SimulationHistory>;
    onHistoryChanged?: (depth: number) => void;
  };
  setWorld: (world: WorldState) => void;
};

export const applySimulationFrameResult = ({
  frameTime,
  currentWorld,
  frameResult,
  reactWorldPublishIntervalMs = DEFAULT_REACT_WORLD_PUBLISH_INTERVAL_MS,
  refs: {
    accumulatorRef,
    trailsRef,
    simStepCounterRef,
    cameraRef,
    forceFastZoomInFramesRef,
    hoverLastUpdateTimeRef,
    worldRef,
    lastWorldPublishTimeRef,
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
    onHistoryChanged?.(getHistorySnapshotCount(historyRef.current));
    perfMonitor.incrementCounter("history.onHistoryChanged.calls");
  }
  accumulatorRef.current = frameResult.nextAccumulator;
  trailsRef.current = frameResult.nextTrails;
  simStepCounterRef.current = frameResult.nextSimStepCounter;
  cameraRef.current = frameResult.nextCamera;
  forceFastZoomInFramesRef.current = frameResult.nextForceFastZoomInFrames;
  hoverLastUpdateTimeRef.current = frameResult.nextHoverLastUpdateTime;
  if (frameResult.worldChanged) {
    const nextWorld = frameResult.nextWorld;
    worldRef.current = nextWorld;
    const runStateChanged = currentWorld.isRunning !== nextWorld.isRunning;
    const publishDue = frameTime - lastWorldPublishTimeRef.current >= reactWorldPublishIntervalMs;
    const shouldPublish = runStateChanged || !nextWorld.isRunning || publishDue;
    if (shouldPublish) {
      setWorld(nextWorld);
      lastWorldPublishTimeRef.current = frameTime;
      perfMonitor.incrementCounter("react.worldPublish.calls");
    } else {
      perfMonitor.incrementCounter("react.worldPublish.throttled");
    }
  }
};

export const shouldScheduleNextTick = ({
  isRunning,
  manualPanZoom,
  forceFastZoomInFrames,
}: {
  isRunning: boolean;
  manualPanZoom: boolean;
  forceFastZoomInFrames: number;
}): boolean => isRunning || (!manualPanZoom && forceFastZoomInFrames > 0);

type UseSimulationLoopResult = {
  requestRender: () => void;
};

export const useSimulationLoop = ({
  canvasRef,
  viewport,
  runtime: {
    isRunning,
    lockMode,
    manualPanZoom,
    showOriginMarker,
    showGrid,
    showCenterOfMass,
    reactWorldPublishIntervalMs,
  },
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
}: UseSimulationLoopArgs): UseSimulationLoopResult => {
  const tickRef = useRef((time: number) => {
    void time;
  });
  const lastWorldPublishTimeRef = useRef(-Infinity);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame((time) => tickRef.current(time));
  }, [rafRef]);

  const requestRender = useCallback(() => {
    perfMonitor.incrementCounter("raf.requestRender.calls");
    scheduleFrame();
  }, [scheduleFrame]);

  const onHoverRefreshEvent = useEffectEvent((bodyId: string) => {
    refreshHoverTooltipForBodyId(bodyId);
  });

  useEffect(() => {
    // noinspection UnnecessaryLocalVariableJS
    const tick = (time: number) => {
      rafRef.current = null;
      const frameStart = performance.now();
      const canvas = canvasRef.current;
      if (!canvas) {
        perfMonitor.incrementCounter("raf.skip.noCanvas");
        scheduleFrame();
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        perfMonitor.incrementCounter("raf.skip.noContext");
        scheduleFrame();
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
        frameTime: time,
        currentWorld,
        frameResult,
        reactWorldPublishIntervalMs,
        refs: {
          accumulatorRef,
          trailsRef,
          simStepCounterRef,
          cameraRef,
          forceFastZoomInFramesRef,
          hoverLastUpdateTimeRef,
          worldRef,
          lastWorldPublishTimeRef,
          historyRef,
          onHistoryChanged,
        },
        setWorld,
      });
      perfMonitor.recordDuration("raf.tick.total", performance.now() - frameStart);
      perfMonitor.incrementCounter("raf.tick.calls");

      const shouldContinueWhilePaused = shouldScheduleNextTick({
        isRunning: worldRef.current.isRunning,
        manualPanZoom,
        forceFastZoomInFrames: forceFastZoomInFramesRef.current,
      });
      if (shouldContinueWhilePaused) {
        scheduleFrame();
      } else {
        perfMonitor.incrementCounter("raf.tick.idleStops");
      }
    };

    tickRef.current = tick;
    scheduleFrame();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- RefObject params are stable identities; effect should react only to runtime flags/viewport/setWorld.
  }, [
    lockMode,
    manualPanZoom,
    reactWorldPublishIntervalMs,
    showCenterOfMass,
    showGrid,
    showOriginMarker,
    isRunning,
    viewport,
    setWorld,
  ]);

  return {
    requestRender,
  };
};
