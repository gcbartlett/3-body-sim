import {
  coreEscapeMetricsForBody,
  EJECTION_TIME_THRESHOLD_SECONDS,
  type CoreEscapeMetrics,
} from "./ejection";
import { formatDiagnosticValue } from "./diagnosticFormatting";
import { worldToScreen, type Camera } from "./camera";
import { computeAccelerations } from "./physics";
import type { BodyState, SimParams, Vec2, WorldState } from "./types";
import { magnitude } from "./vector";
import { perfMonitor } from "../perf/perfMonitor";

const ejectionCounterLabel = (
  isEjected: boolean,
  ejectionTimeSec: number,
  ejectionThresholdSec: number,
): string =>
  isEjected
    ? "ejected"
    : `${ejectionTimeSec.toFixed(1)}s/${ejectionThresholdSec.toFixed(0)}s`;

export const buildHoverTooltipLines = ({
  body,
  bodyIndex,
  acceleration,
  ejectMetrics,
  ejectionTimeSec,
  ejectionThresholdSec,
  isEjected,
}: {
  body: BodyState;
  bodyIndex: number;
  acceleration: Vec2;
  ejectMetrics: CoreEscapeMetrics | null;
  ejectionTimeSec: number;
  ejectionThresholdSec: number;
  isEjected: boolean;
}): string[] => {
  const speed = magnitude(body.velocity);
  const aParallel =
    speed > 1e-9
      ? (acceleration.x * body.velocity.x + acceleration.y * body.velocity.y) / speed
      : 0;
  const ejectionCntText = ejectionCounterLabel(isEjected, ejectionTimeSec, ejectionThresholdSec);

  return [
    `Body ${bodyIndex + 1}`,
    `r: (${formatDiagnosticValue(body.position.x)}, ${formatDiagnosticValue(body.position.y)})`,
    `v: (${formatDiagnosticValue(body.velocity.x)}, ${formatDiagnosticValue(body.velocity.y)}) |v|: ${formatDiagnosticValue(speed)}`,
    `a: (${formatDiagnosticValue(acceleration.x)}, ${formatDiagnosticValue(acceleration.y)}) a||: ${formatDiagnosticValue(aParallel)}`,
    `Erel: ${formatDiagnosticValue(ejectMetrics?.energy ?? 0)}`,
    `v/vesc: ${formatDiagnosticValue(ejectMetrics?.speedRatioToEscape ?? 0)}`,
    `out: ${(ejectMetrics?.outward ?? false) ? "Y" : "N"} ` +
      `cnt: ${ejectionCntText}`,
  ];
};

export type HoverTooltipSnapshot = {
  bodyId: string;
  x: number;
  y: number;
  color: string;
  lines: string[];
};

export const findBodyIndexById = (bodies: BodyState[], bodyId: string): number =>
  bodies.findIndex((body) => body.id === bodyId);

export const findNearestBodyIndexAtScreenPoint = (
  bodies: BodyState[],
  camera: Camera,
  viewport: { width: number; height: number },
  screenX: number,
  screenY: number,
  thresholdPx: number,
): { bodyIndex: number; screen: Vec2 } | null => {
  let nearestIndex = -1;
  let nearestDistSq = Number.POSITIVE_INFINITY;
  let nearestScreen = { x: 0, y: 0 };

  for (let i = 0; i < bodies.length; ++i) {
    const screen = worldToScreen(bodies[i].position, camera, viewport);
    const dx = screen.x - screenX;
    const dy = screen.y - screenY;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = i;
      nearestScreen = screen;
    }
  }

  if (nearestIndex < 0 || nearestDistSq > thresholdPx * thresholdPx) {
    return null;
  }

  return { bodyIndex: nearestIndex, screen: nearestScreen };
};

export const buildHoverTooltipSnapshotForBodyIndex = ({
  world,
  params,
  camera,
  viewport,
  bodyIndex,
  screen,
}: {
  world: WorldState;
  params: SimParams;
  camera: Camera;
  viewport: { width: number; height: number };
  bodyIndex: number;
  screen?: Vec2;
}): HoverTooltipSnapshot | null => {
  const body = world.bodies[bodyIndex];
  if (!body) {
    return null;
  }

  perfMonitor.incrementCounter("hover.computeAccelerations.calls");
  const accelerations = perfMonitor.measure("hover.computeAccelerations", () =>
    computeAccelerations(world.bodies, params),
  );
  const acceleration = accelerations[bodyIndex];
  const ejectMetrics = coreEscapeMetricsForBody(bodyIndex, world, params);
  const ejectionTimeSec = world.ejectionCounterById[body.id] ?? 0;
  const isEjected =
    world.ejectedBodyIds.includes(body.id) ||
    ejectionTimeSec >= EJECTION_TIME_THRESHOLD_SECONDS;
  const screenPos = screen ?? worldToScreen(body.position, camera, viewport);

  return {
    bodyId: body.id,
    x: screenPos.x,
    y: screenPos.y,
    color: body.color,
    lines: buildHoverTooltipLines({
      body,
      bodyIndex,
      acceleration,
      ejectMetrics,
      ejectionTimeSec,
      ejectionThresholdSec: EJECTION_TIME_THRESHOLD_SECONDS,
      isEjected,
    }),
  };
};
