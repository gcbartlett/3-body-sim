import type { BodyState, Vec2 } from "./types";

export type Camera = {
  center: Vec2;
  worldUnitsPerPixel: number;
};

const computeBounds = (bodies: BodyState[]) => {
  const xs = bodies.map((b) => b.position.x);
  const ys = bodies.map((b) => b.position.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

export const updateCamera = (
  previous: Camera,
  bodies: BodyState[],
  viewport: { width: number; height: number },
  damping = 0.1,
): Camera => {
  if (bodies.length === 0 || viewport.width <= 0 || viewport.height <= 0) {
    return previous;
  }

  const bounds = computeBounds(bodies);
  const center = {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
  };

  const width = Math.max(0.5, bounds.maxX - bounds.minX);
  const height = Math.max(0.5, bounds.maxY - bounds.minY);
  const targetFraction = 0.66;
  const targetWorldUnitsPerPixel = Math.max(
    width / (viewport.width * targetFraction),
    height / (viewport.height * targetFraction),
  );

  const lerp = (from: number, to: number) => from + (to - from) * damping;
  return {
    center: {
      x: lerp(previous.center.x, center.x),
      y: lerp(previous.center.y, center.y),
    },
    worldUnitsPerPixel: lerp(
      previous.worldUnitsPerPixel,
      Math.max(0.001, targetWorldUnitsPerPixel),
    ),
  };
};

export const worldToScreen = (
  world: Vec2,
  camera: Camera,
  viewport: { width: number; height: number },
): Vec2 => {
  return {
    x: viewport.width * 0.5 + (world.x - camera.center.x) / camera.worldUnitsPerPixel,
    y: viewport.height * 0.5 + (world.y - camera.center.y) / camera.worldUnitsPerPixel,
  };
};
