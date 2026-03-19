import { useRef } from "react";
import type { PointerEvent, RefObject, WheelEvent } from "react";
import type { Camera } from "../sim/camera";

const MIN_WORLD_UNITS_PER_PIXEL = 0.0005;
const MAX_WORLD_UNITS_PER_PIXEL = 5;

type ViewportSize = {
  width: number;
  height: number;
};

type UseCanvasCameraControlsArgs = {
  cameraRef: RefObject<Camera>;
  viewport: ViewportSize;
  manualPanZoomRef: RefObject<boolean>;
  setManualMode: (enabled: boolean) => void;
  onPointerHover: (x: number, y: number) => void;
  onPointerHoverClear: () => void;
};

export const useCanvasCameraControls = ({
  cameraRef,
  viewport,
  manualPanZoomRef,
  setManualMode,
  onPointerHover,
  onPointerHoverClear,
}: UseCanvasCameraControlsArgs) => {
  const dragRef = useRef<{ active: boolean; pointerId: number | null; x: number; y: number }>({
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
  });
  const touchRef = useRef<{
    points: Map<number, { x: number; y: number }>;
    lastDistance: number | null;
    lastMidpoint: { x: number; y: number } | null;
  }>({
    points: new Map(),
    lastDistance: null,
    lastMidpoint: null,
  });

  const panCameraByScreenDelta = (dx: number, dy: number) => {
    const cam = cameraRef.current;
    cameraRef.current = {
      ...cam,
      center: {
        x: cam.center.x - dx * cam.worldUnitsPerPixel,
        y: cam.center.y - dy * cam.worldUnitsPerPixel,
      },
    };
  };

  const zoomCameraAtScreenPoint = (screen: { x: number; y: number }, zoomFactor: number) => {
    const cam = cameraRef.current;
    const clampedFactor = Math.max(0.2, Math.min(5, zoomFactor));
    const nextScale = Math.max(
      MIN_WORLD_UNITS_PER_PIXEL,
      Math.min(MAX_WORLD_UNITS_PER_PIXEL, cam.worldUnitsPerPixel * clampedFactor),
    );
    const worldBefore = {
      x: cam.center.x + (screen.x - viewport.width * 0.5) * cam.worldUnitsPerPixel,
      y: cam.center.y + (screen.y - viewport.height * 0.5) * cam.worldUnitsPerPixel,
    };
    cameraRef.current = {
      center: {
        x: worldBefore.x - (screen.x - viewport.width * 0.5) * nextScale,
        y: worldBefore.y - (screen.y - viewport.height * 0.5) * nextScale,
      },
      worldUnitsPerPixel: nextScale,
    };
  };

  const onCanvasPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      setManualMode(true);
    }
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.pointerType === "touch") {
      touchRef.current.points.set(e.pointerId, { x, y });
      if (touchRef.current.points.size === 2) {
        const [a, b] = Array.from(touchRef.current.points.values());
        touchRef.current.lastDistance = Math.hypot(b.x - a.x, b.y - a.y);
        touchRef.current.lastMidpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      } else if (touchRef.current.points.size === 1) {
        touchRef.current.lastMidpoint = { x, y };
      }
      return;
    }

    dragRef.current = { active: true, pointerId: e.pointerId, x, y };
  };

  const onCanvasPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.pointerType !== "touch") {
      onPointerHover(x, y);
    } else {
      onPointerHoverClear();
    }

    if (!manualPanZoomRef.current) {
      return;
    }

    if (e.pointerType === "touch") {
      if (!touchRef.current.points.has(e.pointerId)) {
        return;
      }
      touchRef.current.points.set(e.pointerId, { x, y });
      if (touchRef.current.points.size === 2) {
        const [a, b] = Array.from(touchRef.current.points.values());
        const midpoint = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (touchRef.current.lastMidpoint) {
          panCameraByScreenDelta(
            midpoint.x - touchRef.current.lastMidpoint.x,
            midpoint.y - touchRef.current.lastMidpoint.y,
          );
        }
        if (touchRef.current.lastDistance && distance > 0) {
          zoomCameraAtScreenPoint(midpoint, touchRef.current.lastDistance / distance);
        }
        touchRef.current.lastDistance = distance;
        touchRef.current.lastMidpoint = midpoint;
      } else if (touchRef.current.points.size === 1) {
        const only = Array.from(touchRef.current.points.values())[0];
        if (touchRef.current.lastMidpoint) {
          panCameraByScreenDelta(
            only.x - touchRef.current.lastMidpoint.x,
            only.y - touchRef.current.lastMidpoint.y,
          );
        }
        touchRef.current.lastMidpoint = only;
      }
      return;
    }

    if (!dragRef.current.active || dragRef.current.pointerId !== e.pointerId) {
      return;
    }
    panCameraByScreenDelta(x - dragRef.current.x, y - dragRef.current.y);
    dragRef.current.x = x;
    dragRef.current.y = y;
  };

  const onCanvasPointerUpOrCancel = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      return;
    }
    if (dragRef.current.active && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = { active: false, pointerId: null, x: 0, y: 0 };
    }
    touchRef.current.points.delete(e.pointerId);
    if (touchRef.current.points.size < 2) {
      touchRef.current.lastDistance = null;
      touchRef.current.lastMidpoint =
        touchRef.current.points.size === 1
          ? Array.from(touchRef.current.points.values())[0]
          : null;
    }
  };

  const onCanvasPointerLeave = () => {
    onPointerHoverClear();
  };

  const onCanvasWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    if (!manualPanZoomRef.current) {
      setManualMode(true);
    }
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const zoomFactor = Math.exp(e.deltaY * 0.0015);
    zoomCameraAtScreenPoint({ x, y }, zoomFactor);
  };

  const onCanvasDoubleClick = () => {
    setManualMode(false);
  };

  return {
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUpOrCancel,
    onCanvasPointerLeave,
    onCanvasWheel,
    onCanvasDoubleClick,
  };
};
