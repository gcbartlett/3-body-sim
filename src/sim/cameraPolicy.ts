import { updateCamera, type Camera } from "./camera";
import { centerOfMass } from "./physics";
import type { BodyState, LockMode, Vec2 } from "./types";

const VIEWPORT_TARGET_FRACTION = 0.66;
const ZOOM_DAMPING_OUT = 0.2;
const ZOOM_DAMPING_IN = 0.0025;
const ZOOM_IN_HYSTERESIS = 0.08;

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
  const trackedCamera = updateCamera(camera, bodies, viewport);
  const com = centerOfMass(bodies);
  const targetCenter = computeTargetCenter(lockMode, com, trackedCamera.center);
  const requiredWorldUnitsPerPixel = requiredScaleForBodies(bodies, targetCenter, viewport);
  const currentScale = camera.worldUnitsPerPixel;
  const needZoomOut = requiredWorldUnitsPerPixel > currentScale;
  const allowZoomIn = requiredWorldUnitsPerPixel < currentScale * (1 - ZOOM_IN_HYSTERESIS);
  const targetScale = needZoomOut || allowZoomIn ? requiredWorldUnitsPerPixel : currentScale;
  const fastZoomInActive = forceFastZoomInFrames > 0;
  const damping = needZoomOut || fastZoomInActive ? ZOOM_DAMPING_OUT : ZOOM_DAMPING_IN;
  const nextForceFastZoomInFrames = fastZoomInActive ? forceFastZoomInFrames - 1 : 0;

  return {
    camera: {
      ...trackedCamera,
      center: targetCenter,
      worldUnitsPerPixel: currentScale + (targetScale - currentScale) * damping,
    },
    nextForceFastZoomInFrames,
  };
};
