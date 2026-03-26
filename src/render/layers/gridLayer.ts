import { worldToScreen } from "../../sim/camera";
import type { Camera } from "../../sim/camera";
import type { Viewport } from "./types";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const divisibilityLevel = (n: number, radix: number): number => {
  const abs = Math.abs(n);
  if (abs === 0) {
    return 6;
  }

  let level = 0;
  let value = abs;
  while (value % radix === 0) {
    level += 1;
    value /= radix;
    if (level >= 6) {
      break;
    }
  }

  return level;
};

const gridLineStyle = (
  level: number,
  transitionPhase: number,
): { alpha: number; width: number } => {
  if (level <= 0) {
    return { alpha: 0.2 * (1 - transitionPhase), width: 1 };
  }

  if (level === 1) {
    return {
      alpha: lerp(0.34, 0.2, transitionPhase),
      width: lerp(1.16, 1.02, transitionPhase),
    };
  }

  if (level === 2) {
    return {
      alpha: lerp(0.4, 0.34, transitionPhase),
      width: lerp(1.28, 1.2, transitionPhase),
    };
  }

  return { alpha: 0.48, width: 1.34 };
};

export const drawGridLayer = (
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: Viewport,
): void => {
  const halfWidth = viewport.width * 0.5 * camera.worldUnitsPerPixel;
  const halfHeight = viewport.height * 0.5 * camera.worldUnitsPerPixel;
  const minX = camera.center.x - halfWidth;
  const maxX = camera.center.x + halfWidth;
  const minY = camera.center.y - halfHeight;
  const maxY = camera.center.y + halfHeight;
  const baseMinorUnit = 0.25;
  const targetMinorPixels = 24;
  const targetMinorWorld = Math.max(1e-9, targetMinorPixels * camera.worldUnitsPerPixel);
  const radix = 5;
  const logRadix = Math.log(radix);
  const scaleExponent = Math.floor(Math.log(targetMinorWorld / baseMinorUnit) / logRadix);
  const minorStep = baseMinorUnit * Math.pow(radix, scaleExponent);
  const transitionPhase = clamp(Math.log(targetMinorWorld / minorStep) / logRadix, 0, 1);
  const majorMultiple = 5;

  const xStart = Math.ceil(minX / minorStep);
  const xEnd = Math.floor(maxX / minorStep);
  const yStart = Math.ceil(minY / minorStep);
  const yEnd = Math.floor(maxY / minorStep);

  ctx.save();
  for (let n = xStart; n <= xEnd; n += 1) {
    const x = n * minorStep;
    const level = divisibilityLevel(n, majorMultiple);
    const { alpha, width } = gridLineStyle(level, transitionPhase);
    if (alpha <= 0) {
      continue;
    }
    const xScreen = worldToScreen({ x, y: 0 }, camera, viewport).x;
    ctx.strokeStyle = `rgba(225, 235, 248, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(xScreen, 0);
    ctx.lineTo(xScreen, viewport.height);
    ctx.stroke();
  }

  for (let n = yStart; n <= yEnd; n += 1) {
    const y = n * minorStep;
    const level = divisibilityLevel(n, majorMultiple);
    const { alpha, width } = gridLineStyle(level, transitionPhase);
    if (alpha <= 0) {
      continue;
    }
    const yScreen = worldToScreen({ x: 0, y }, camera, viewport).y;
    ctx.strokeStyle = `rgba(225, 235, 248, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, yScreen);
    ctx.lineTo(viewport.width, yScreen);
    ctx.stroke();
  }
  ctx.restore();
};
