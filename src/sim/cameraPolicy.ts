import type { Camera } from "./camera";
import { centerOfMass } from "./physics";
import type { BodyState, LockMode, Vec2 } from "./types";

const VIEWPORT_TARGET_FRACTION = 0.66;
const ZOOM_DAMPING_OUT = 0.2;
const ZOOM_DAMPING_IN = 0.0025;
const ZOOM_IN_HYSTERESIS = 0.08;
const CENTER_DAMPING_NORMAL = 0.1;
const CENTER_DAMPING_FAST = 0.2;

type Viewport = {
  width: number;
  height: number;
};

type AutoCameraArgs = {
  camera: Camera;
  bodies: BodyState[];
  viewport: Viewport;
  lockMode: LockMode;
  forceFastZoomInFrames: number;
};

export type AutoCameraResult = {
  camera: Camera;
  nextForceFastZoomInFrames: number;
};

const computeTargetCenter = (lockMode: LockMode, centerOfMassPosition: Vec2, trackedCenter: Vec2): Vec2 => {
  if (lockMode === "com") {
    return centerOfMassPosition;
  }
  if (lockMode === "origin") {
    return { x: 0, y: 0 };
  }
  return trackedCenter;
};

const computeTrackedCenter = (bodies: BodyState[], fallback: Vec2): Vec2 => {
  if (bodies.length === 0) {
    return fallback;
  }
  let minX = bodies[0].position.x;
  let maxX = bodies[0].position.x;
  let minY = bodies[0].position.y;
  let maxY = bodies[0].position.y;

  for (let i = 1; i < bodies.length; ++i) {
    const x = bodies[i].position.x;
    const y = bodies[i].position.y;
    if (x < minX) {
      minX = x;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (y > maxY) {
      maxY = y;
    }
  }

  return {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5,
  };
};

const requiredScaleForBodies = (
  bodies: BodyState[],
  targetCenter: Vec2,
  viewport: Viewport,
): number => {
  if (bodies.length === 0) {
    return 0.001;
  }

  const xs = bodies.map((body) => body.position.x);
  const ys = bodies.map((body) => body.position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.5, maxX - minX);
  const spanY = Math.max(0.5, maxY - minY);
  const universalRequiredWorldUnitsPerPixel = Math.max(
    0.001,
    spanX / Math.max(1, viewport.width * VIEWPORT_TARGET_FRACTION),
    spanY / Math.max(1, viewport.height * VIEWPORT_TARGET_FRACTION),
  );

  const maxOffsetX = bodies.reduce(
    (max, body) => Math.max(max, Math.abs(body.position.x - targetCenter.x)),
    0,
  );
  const maxOffsetY = bodies.reduce(
    (max, body) => Math.max(max, Math.abs(body.position.y - targetCenter.y)),
    0,
  );

  return Math.max(
    universalRequiredWorldUnitsPerPixel,
    maxOffsetX / Math.max(1, viewport.width * 0.5 * VIEWPORT_TARGET_FRACTION),
    maxOffsetY / Math.max(1, viewport.height * 0.5 * VIEWPORT_TARGET_FRACTION),
  );
};

export const computeAutoCamera = ({
  camera,
  bodies,
  viewport,
  lockMode,
  forceFastZoomInFrames,
}: AutoCameraArgs): AutoCameraResult => {
  const trackedCenter = computeTrackedCenter(bodies, camera.center);
  const com = centerOfMass(bodies);
  const targetCenter = computeTargetCenter(lockMode, com, trackedCenter);
  const requiredWorldUnitsPerPixel = requiredScaleForBodies(bodies, targetCenter, viewport);
  const currentScale = camera.worldUnitsPerPixel;
  const needZoomOut = requiredWorldUnitsPerPixel > currentScale;
  const allowZoomIn = requiredWorldUnitsPerPixel < currentScale * (1 - ZOOM_IN_HYSTERESIS);
  const targetScale = needZoomOut || allowZoomIn ? requiredWorldUnitsPerPixel : currentScale;
  const fastZoomInActive = forceFastZoomInFrames > 0;
  const damping = needZoomOut || fastZoomInActive ? ZOOM_DAMPING_OUT : ZOOM_DAMPING_IN;
  const centerDamping = fastZoomInActive ? CENTER_DAMPING_FAST : CENTER_DAMPING_NORMAL;
  const nextForceFastZoomInFrames = fastZoomInActive ? forceFastZoomInFrames - 1 : 0;

  return {
    camera: {
      ...camera,
      center: {
        x: camera.center.x + (targetCenter.x - camera.center.x) * centerDamping,
        y: camera.center.y + (targetCenter.y - camera.center.y) * centerDamping,
      },
      worldUnitsPerPixel: currentScale + (targetScale - currentScale) * damping,
    },
    nextForceFastZoomInFrames,
  };
};
