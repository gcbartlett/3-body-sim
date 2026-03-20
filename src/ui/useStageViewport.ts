import { useEffect, useState } from "react";
import type { RefObject } from "react";

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
      const usableHeight = Math.max(
        MIN_VIEWPORT_HEIGHT_PX,
        Math.floor(rect.height - diagnosticsInsetPx),
      );
      setViewport({
        width: Math.max(MIN_VIEWPORT_WIDTH_PX, Math.floor(rect.width)),
        height: usableHeight,
      });
    };

    updateViewportFromRect(element.getBoundingClientRect());
    const observer = new ResizeObserver((entries) => {
      updateViewportFromRect(entries[0].contentRect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [diagnosticsInsetPx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
  }, [viewport]);

  return viewport;
};
