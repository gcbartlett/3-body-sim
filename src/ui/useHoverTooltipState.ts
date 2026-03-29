import { useRef, useState, type RefObject } from "react";
import { type Camera } from "../sim/camera";
import {
  buildHoverTooltipSnapshotForBodyIndex,
  findBodyIndexById,
  findNearestBodyIndexAtScreenPoint,
} from "../sim/hoverDiagnostics";
import type { SimParams, WorldState } from "../sim/types";
import { perfMonitor } from "../perf/perfMonitor";

type Viewport = {
  width: number;
  height: number;
};

type HoverBodyTooltip = {
  x: number;
  y: number;
  color: string;
  lines: string[];
};

type UseHoverTooltipStateArgs = {
  worldRef: RefObject<WorldState>;
  paramsRef: RefObject<SimParams>;
  cameraRef: RefObject<Camera>;
  viewport: Viewport;
};

export const useHoverTooltipState = ({
  worldRef,
  paramsRef,
  cameraRef,
  viewport,
}: UseHoverTooltipStateArgs) => {
  const [hoverBody, setHoverBody] = useState<HoverBodyTooltip | null>(null);
  const hoverBodyIdRef = useRef<string | null>(null);
  const hoverLastUpdateTimeRef = useRef(0);

  const clearHoverBody = () => {
    hoverBodyIdRef.current = null;
    hoverLastUpdateTimeRef.current = 0;
    setHoverBody(null);
  };

  const updateBodyHoverTooltip = (screenX: number, screenY: number) => {
    const start = performance.now();
    const bodies = worldRef.current.bodies;
    if (bodies.length === 0) {
      clearHoverBody();
      perfMonitor.recordDuration("hover.update.total", performance.now() - start);
      return;
    }

    const thresholdPx = 16;
    const nearest = findNearestBodyIndexAtScreenPoint(
      bodies,
      cameraRef.current,
      viewport,
      screenX,
      screenY,
      thresholdPx,
    );
    if (!nearest) {
      clearHoverBody();
      perfMonitor.recordDuration("hover.update.total", performance.now() - start);
      return;
    }

    const snapshot = buildHoverTooltipSnapshotForBodyIndex({
      world: worldRef.current,
      params: paramsRef.current,
      camera: cameraRef.current,
      viewport,
      bodyIndex: nearest.bodyIndex,
      screen: nearest.screen,
    });
    if (!snapshot) {
      clearHoverBody();
      perfMonitor.recordDuration("hover.update.total", performance.now() - start);
      return;
    }

    hoverBodyIdRef.current = snapshot.bodyId;
    hoverLastUpdateTimeRef.current = performance.now();
    setHoverBody({
      x: snapshot.x,
      y: snapshot.y,
      color: snapshot.color,
      lines: snapshot.lines,
    });
    perfMonitor.recordDuration("hover.update.total", performance.now() - start);
    perfMonitor.incrementCounter("hover.update.success");
  };

  const refreshHoverTooltipForBodyId = (bodyId: string) => {
    const start = performance.now();
    const index = findBodyIndexById(worldRef.current.bodies, bodyId);
    if (index < 0) {
      hoverBodyIdRef.current = null;
      setHoverBody(null);
      perfMonitor.recordDuration("hover.refreshById.total", performance.now() - start);
      return;
    }
    const snapshot = buildHoverTooltipSnapshotForBodyIndex({
      world: worldRef.current,
      params: paramsRef.current,
      camera: cameraRef.current,
      viewport,
      bodyIndex: index,
    });
    if (!snapshot) {
      hoverBodyIdRef.current = null;
      setHoverBody(null);
      perfMonitor.recordDuration("hover.refreshById.total", performance.now() - start);
      return;
    }
    setHoverBody({
      x: snapshot.x,
      y: snapshot.y,
      color: snapshot.color,
      lines: snapshot.lines,
    });
    perfMonitor.recordDuration("hover.refreshById.total", performance.now() - start);
    perfMonitor.incrementCounter("hover.refreshById.success");
  };

  return {
    hoverBody,
    hoverBodyIdRef,
    hoverLastUpdateTimeRef,
    clearHoverBody,
    updateBodyHoverTooltip,
    refreshHoverTooltipForBodyId,
  };
};
