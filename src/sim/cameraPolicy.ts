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
  topInsetPx: number;
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

const clampedTopInsetPx = (topInsetPx: number, viewport: Viewport): number =>
  Math.max(0, Math.min(topInsetPx, Math.max(0, viewport.height - 1)));

const centeredInVisibleBand = (
  targetCenter: Vec2,
  worldUnitsPerPixel: number,
  viewport: Viewport,
  topInsetPx: number,
): Vec2 => {
  const insetPx = clampedTopInsetPx(topInsetPx, viewport);
  const worldYOffset = insetPx * 0.5 * worldUnitsPerPixel;
  return {
    x: targetCenter.x,
    y: targetCenter.y - worldYOffset,
  };
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
  topInsetPx: number,
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
  const insetPx = clampedTopInsetPx(topInsetPx, viewport);
  const usableHeightPx = Math.max(1, viewport.height - insetPx);
  const spanX = Math.max(0.5, maxX - minX);
  const spanY = Math.max(0.5, maxY - minY);
  let requiredWorldUnitsPerPixel = Math.max(
    0.001,
    spanX / Math.max(1, viewport.width * VIEWPORT_TARGET_FRACTION),
    spanY / Math.max(1, usableHeightPx * VIEWPORT_TARGET_FRACTION),
  );
  for (let i = 0; i < 2; ++i) {
    const framingCenter = centeredInVisibleBand(
      targetCenter,
      requiredWorldUnitsPerPixel,
      viewport,
      topInsetPx,
    );
    const maxOffsetX = bodies.reduce(
      (max, body) => Math.max(max, Math.abs(body.position.x - framingCenter.x)),
      0,
    );
    const maxOffsetY = bodies.reduce(
      (max, body) => Math.max(max, Math.abs(body.position.y - framingCenter.y)),
      0,
    );
    requiredWorldUnitsPerPixel = Math.max(
      requiredWorldUnitsPerPixel,
      maxOffsetX / Math.max(1, viewport.width * 0.5 * VIEWPORT_TARGET_FRACTION),
      maxOffsetY / Math.max(1, usableHeightPx * 0.5 * VIEWPORT_TARGET_FRACTION),
    );
  }
  return requiredWorldUnitsPerPixel;
};

export const computeAutoCamera = ({
  camera,
  bodies,
  viewport,
  topInsetPx,
  lockMode,
  forceFastZoomInFrames,
}: AutoCameraArgs): AutoCameraResult => {
  const trackedCenter = computeTrackedCenter(bodies, camera.center);
  const com = centerOfMass(bodies);
  const targetCenter = computeTargetCenter(lockMode, com, trackedCenter);
  const requiredWorldUnitsPerPixel = requiredScaleForBodies(
    bodies,
    targetCenter,
    viewport,
    topInsetPx,
  );
  const currentScale = camera.worldUnitsPerPixel;
  const needZoomOut = requiredWorldUnitsPerPixel > currentScale;
  const allowZoomIn = requiredWorldUnitsPerPixel < currentScale * (1 - ZOOM_IN_HYSTERESIS);
  const targetScale = needZoomOut || allowZoomIn ? requiredWorldUnitsPerPixel : currentScale;
  const fastZoomInActive = forceFastZoomInFrames > 0;
  const damping = needZoomOut || fastZoomInActive ? ZOOM_DAMPING_OUT : ZOOM_DAMPING_IN;
  const centerDamping = fastZoomInActive ? CENTER_DAMPING_FAST : CENTER_DAMPING_NORMAL;
  const nextForceFastZoomInFrames = fastZoomInActive ? forceFastZoomInFrames - 1 : 0;
  const nextWorldUnitsPerPixel = currentScale + (targetScale - currentScale) * damping;
  const framingTargetCenter = centeredInVisibleBand(
    targetCenter,
    nextWorldUnitsPerPixel,
    viewport,
    topInsetPx,
  );

  return {
    camera: {
      ...camera,
      center: {
        x: camera.center.x + (framingTargetCenter.x - camera.center.x) * centerDamping,
        y: camera.center.y + (framingTargetCenter.y - camera.center.y) * centerDamping,
      },
      worldUnitsPerPixel: nextWorldUnitsPerPixel,
    },
    nextForceFastZoomInFrames,
  };
};
