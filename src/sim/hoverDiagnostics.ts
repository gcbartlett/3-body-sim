import type { CoreEscapeMetrics } from "./ejection";
import type { BodyState, Vec2 } from "./types";
import { magnitude } from "./vector";

const formatDiag = (value: number): string => {
  const normalized = Math.abs(value) < 0.0005 ? 0 : value;
  const abs = Math.abs(normalized);
  const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(dp)}`;
};

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
    `r: (${formatDiag(body.position.x)}, ${formatDiag(body.position.y)})`,
    `v: (${formatDiag(body.velocity.x)}, ${formatDiag(body.velocity.y)}) |v|: ${formatDiag(speed)}`,
    `a: (${formatDiag(acceleration.x)}, ${formatDiag(acceleration.y)}) a||: ${formatDiag(aParallel)}`,
    `Erel: ${formatDiag(ejectMetrics?.energy ?? 0)}`,
    `v/vesc: ${formatDiag(ejectMetrics?.speedRatioToEscape ?? 0)}`,
    `out: ${(ejectMetrics?.outward ?? false) ? "Y" : "N"} ` +
      `cnt: ${ejectionCntText}`,
  ];
};
