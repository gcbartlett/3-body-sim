import type { Camera } from "../sim/camera";
import { worldToScreen } from "../sim/camera";
import type { BodyState } from "../sim/types";

type Viewport = { width: number; height: number };
type RenderOptions = {
  showOrigin: boolean;
  showGrid: boolean;
  showCenterOfMass: boolean;
  centerOfMass: { x: number; y: number };
};
export type TrailPoint = {
  x: number;
  y: number;
  life: number;
};
export type TrailMap = Record<string, TrailPoint[]>;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const MIN_BODY_RADIUS_PX = 3;
const MAX_BODY_RADIUS_PX = 20;

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
    return {
      alpha: 0.2 * (1 - transitionPhase),
      width: 1,
    };
  }

  if (level === 1) {
    return {
      // Current major lines gradually relax as they approach demotion.
      alpha: lerp(0.34, 0.2, transitionPhase),
      width: lerp(1.16, 1.02, transitionPhase),
    };
  }

  if (level === 2) {
    return {
      // Next-level majors are already emphasized before promotion.
      alpha: lerp(0.4, 0.34, transitionPhase),
      width: lerp(1.28, 1.2, transitionPhase),
    };
  }

  return {
    alpha: 0.48,
    width: 1.34,
  };
};

const bodyRadiusFromMasses = (mass: number, masses: number[]): number => {
  const minMass = Math.min(...masses);
  const maxMass = Math.max(...masses);
  if (Math.abs(maxMass - minMass) < 1e-9) {
    return (MIN_BODY_RADIUS_PX + MAX_BODY_RADIUS_PX) * 0.5;
  }
  const t = (mass - minMass) / (maxMass - minMass);
  const radius = MIN_BODY_RADIUS_PX + (MAX_BODY_RADIUS_PX - MIN_BODY_RADIUS_PX) * t;
  return Math.max(MIN_BODY_RADIUS_PX, Math.min(MAX_BODY_RADIUS_PX, radius));
};

let cachedMassSignature = "";
let cachedRadiusById: Record<string, number> = {};

const radiusMapForBodies = (bodies: BodyState[]): Record<string, number> => {
  const signature = bodies.map((body) => `${body.id}:${body.mass}`).join("|");
  if (signature === cachedMassSignature) {
    return cachedRadiusById;
  }

  const masses = bodies.map((body) => body.mass);
  const next: Record<string, number> = {};
  for (const body of bodies) {
    next[body.id] = bodyRadiusFromMasses(body.mass, masses);
  }
  cachedMassSignature = signature;
  cachedRadiusById = next;
  return next;
};

const drawGrid = (
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
  const transitionPhase = clamp(
    Math.log(targetMinorWorld / minorStep) / logRadix,
    0,
    1,
  );
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
    drawGrid(ctx, camera, viewport);
  }
  const radiusById = radiusMapForBodies(bodies);

  for (const body of bodies) {
    const bodyTrails = trails[body.id] ?? [];
    for (const point of bodyTrails) {
      const p = worldToScreen({ x: point.x, y: point.y }, camera, viewport);
      const radius = 2;
      const alpha = Math.max(0, Math.min(1, point.life));
      if (alpha <= 0) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(body.color, alpha);
      ctx.fill();
    }
  }

  const bodiesByDrawOrder = [...bodies].sort(
    (a, b) => (radiusById[b.id] ?? 0) - (radiusById[a.id] ?? 0),
  );

  for (const body of bodiesByDrawOrder) {
    const p = worldToScreen(body.position, camera, viewport);
    const radius = radiusById[body.id] ?? ((MIN_BODY_RADIUS_PX + MAX_BODY_RADIUS_PX) * 0.5);
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

const withAlpha = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) {
    return `rgba(255,255,255,${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
