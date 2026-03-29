import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { perfMonitor } from "../perf/perfMonitor";

type ViewportSize = {
  width: number;
  height: number;
};

type UseStageViewportArgs = {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  diagnosticsInsetPx: number;
};

const MIN_VIEWPORT_WIDTH_PX = 320;
const MIN_VIEWPORT_HEIGHT_PX = 120;

export const useStageViewport = ({
  containerRef,
  canvasRef,
  diagnosticsInsetPx,
}: UseStageViewportArgs): ViewportSize => {
  const [viewport, setViewport] = useState<ViewportSize>({ width: 900, height: 700 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateViewportFromRect = (rect: DOMRectReadOnly) => {
      perfMonitor.incrementCounter("layout.stageViewport.rectUpdates");
      const usableHeight = Math.max(
        MIN_VIEWPORT_HEIGHT_PX,
        Math.floor(rect.height - diagnosticsInsetPx),
      );
      const nextViewport = {
        width: Math.max(MIN_VIEWPORT_WIDTH_PX, Math.floor(rect.width)),
        height: usableHeight,
      };
      setViewport((prev) => {
        const changed = prev.width !== nextViewport.width || prev.height !== nextViewport.height;
        perfMonitor.incrementCounter(
          changed ? "layout.stageViewport.changed" : "layout.stageViewport.unchanged",
        );
        return changed ? nextViewport : prev;
      });
    };

    updateViewportFromRect(element.getBoundingClientRect());
    const observer = new ResizeObserver((entries) => {
      perfMonitor.incrementCounter("layout.stageViewport.resizeObserver.callback");
      updateViewportFromRect(entries[0].contentRect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef is a stable RefObject input; reactivity is driven by diagnosticsInsetPx.
  }, [diagnosticsInsetPx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasRef is a stable RefObject input; effect should rerun only when viewport changes.
  }, [viewport]);

  return viewport;
};
