import { worldToScreen } from "../../sim/camera";
import type { Camera } from "../../sim/camera";
import type { BodyState } from "../../sim/types";
import type { Viewport } from "./types";

const MIN_BODY_RADIUS_PX = 3;
const MAX_BODY_RADIUS_PX = 15;
const DEFAULT_BODY_RADIUS_PX = (MIN_BODY_RADIUS_PX + MAX_BODY_RADIUS_PX) / 2;

const bodyRadiusFromMasses = (mass: number, masses: number[]): number => {
  const minMass = Math.min(...masses);
  const maxMass = Math.max(...masses);
  if (Math.abs(maxMass - minMass) < 1e-9) {
    return DEFAULT_BODY_RADIUS_PX;
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

export const drawBodyLayer = (
  ctx: CanvasRenderingContext2D,
  bodies: BodyState[],
  camera: Camera,
  viewport: Viewport,
): void => {
  const radiusById = radiusMapForBodies(bodies);
  const bodiesByDrawOrder = [...bodies].sort(
    (a, b) => (radiusById[b.id] ?? 0) - (radiusById[a.id] ?? 0),
  );

  for (const body of bodiesByDrawOrder) {
    const p = worldToScreen(body.position, camera, viewport);
    const radius = radiusById[body.id] ?? DEFAULT_BODY_RADIUS_PX;
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
