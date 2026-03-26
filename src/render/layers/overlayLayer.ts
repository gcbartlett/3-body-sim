import { worldToScreen } from "../../sim/camera";
import type { Camera } from "../../sim/camera";
import type { RenderOptions, Viewport } from "./types";

export const drawOverlayLayer = (
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: Viewport,
  options: RenderOptions,
): void => {
  if (options.showOrigin) {
    const origin = worldToScreen({ x: 0, y: 0 }, camera, viewport);
    ctx.save();
    ctx.font = "12px Consolas, 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(230, 230, 230, 0.85)";
    ctx.fillText("o", origin.x, origin.y);
    ctx.restore();
  }

  if (options.showCenterOfMass) {
    const com = worldToScreen(options.centerOfMass, camera, viewport);
    ctx.save();
    ctx.fillStyle = "rgba(220, 95, 95, 0.55)";
    ctx.beginPath();
    ctx.arc(com.x, com.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};
