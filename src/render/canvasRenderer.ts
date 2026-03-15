import type { Camera } from "../sim/camera";
import { worldToScreen } from "../sim/camera";
import type { BodyState } from "../sim/types";

type Viewport = { width: number; height: number };

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  trailCtx: CanvasRenderingContext2D,
  bodies: BodyState[],
  camera: Camera,
  viewport: Viewport,
  trailFade: number,
): void => {
  trailCtx.save();
  trailCtx.fillStyle = `rgba(0, 0, 0, ${trailFade})`;
  trailCtx.fillRect(0, 0, viewport.width, viewport.height);

  for (const body of bodies) {
    const p = worldToScreen(body.position, camera, viewport);
    trailCtx.beginPath();
    trailCtx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    trailCtx.fillStyle = body.color;
    trailCtx.fill();
  }
  trailCtx.restore();

  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.drawImage(trailCtx.canvas, 0, 0);

  for (const body of bodies) {
    const p = worldToScreen(body.position, camera, viewport);
    const radius = 6;
    const gradient = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, radius * 3);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.35, body.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const clearTrails = (
  trailCtx: CanvasRenderingContext2D,
  viewport: Viewport,
): void => {
  trailCtx.clearRect(0, 0, viewport.width, viewport.height);
  trailCtx.fillStyle = "black";
  trailCtx.fillRect(0, 0, viewport.width, viewport.height);
};
