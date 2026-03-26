import { worldToScreen } from "../../sim/camera";
import type { Camera } from "../../sim/camera";
import type { BodyState } from "../../sim/types";
import type { TrailMap, Viewport } from "./types";

const withAlpha = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return `rgba(255,255,255,${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const drawTrailLayer = (
  ctx: CanvasRenderingContext2D,
  trails: TrailMap,
  bodies: BodyState[],
  camera: Camera,
  viewport: Viewport,
): void => {
  for (const body of bodies) {
    const bodyTrails = trails[body.id] ?? [];
    for (const point of bodyTrails) {
      const p = worldToScreen({ x: point.x, y: point.y }, camera, viewport);
      const alpha = Math.max(0, Math.min(1, point.life));
      if (alpha <= 0) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(body.color, alpha);
      ctx.fill();
    }
  }
};
