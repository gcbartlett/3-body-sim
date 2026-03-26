import type { Camera } from "../sim/camera";
import type { BodyState } from "../sim/types";
import { drawBodyLayer } from "./layers/bodyLayer";
import { drawGridLayer } from "./layers/gridLayer";
import { drawOverlayLayer } from "./layers/overlayLayer";
import { drawTrailLayer } from "./layers/trailLayer";
import type { RenderOptions, TrailMap, TrailPoint, Viewport } from "./layers/types";

export type { TrailMap, TrailPoint } from "./layers/types";

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  trails: TrailMap,
  bodies: BodyState[],
  camera: Camera,
  viewport: Viewport,
  options: RenderOptions,
): void => {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  if (options.showGrid) {
    drawGridLayer(ctx, camera, viewport);
  }
  drawTrailLayer(ctx, trails, bodies, camera, viewport);
  drawBodyLayer(ctx, bodies, camera, viewport);
  drawOverlayLayer(ctx, camera, viewport, options);
};

export const fadeAndPruneTrails = (
  trails: TrailMap,
  trailFade: number,
): TrailMap => {
  const decayFactor = Math.max(0, 1 - trailFade);
  const result: TrailMap = {};

  for (const [id, points] of Object.entries(trails)) {
    const nextPoints: TrailPoint[] = [];
    for (const point of points) {
      const life = point.life * decayFactor;
      if (life > 0.015) {
        nextPoints.push({ ...point, life });
      }
    }
    result[id] = nextPoints;
  }

  return result;
};
