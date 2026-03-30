import type { SimParams, WorldState } from "./types";
import { magnitudeSquared, sub } from "./vector";

export type CoreEscapeMetrics = {
  energy: number;
  outward: boolean;
  speedRatioToEscape: number;
  strongEscape: boolean;
  coreSeparation: number;
  farCoreRatio: number;
  coreIndices: [number, number];
  relPosition: { x: number; y: number };
  relVelocity: { x: number; y: number };
};

const ESCAPE_SPEED_MARGIN = 0.08;
const MIN_OUTWARD_SPEED_RATIO = 0.05;
export const EJECTION_TIME_THRESHOLD_SECONDS = 10;
export const FAR_FIELD_RATIO_GATE = 5;

export const coreEscapeMetricsForBody = (
  bodyIndex: number,
  world: WorldState,
  params: SimParams,
): CoreEscapeMetrics | null => {
  const body = world.bodies[bodyIndex];
  if (!body) {
    return null;
  }
  const otherIndices = world.bodies
    .map((_, index) => index)
    .filter((index) => index !== bodyIndex);
  if (otherIndices.length < 2) {
    return null;
  }
  const j = otherIndices[0];
  const k = otherIndices[1];
  const bj = world.bodies[j];
  const bk = world.bodies[k];
  const mj = bj.mass;
  const mk = bk.mass;
  const mCore = Math.max(1e-9, mj + mk);

  const corePos = {
    x: (bj.position.x * mj + bk.position.x * mk) / mCore,
    y: (bj.position.y * mj + bk.position.y * mk) / mCore,
  };
  const coreVel = {
    x: (bj.velocity.x * mj + bk.velocity.x * mk) / mCore,
    y: (bj.velocity.y * mj + bk.velocity.y * mk) / mCore,
  };

  const relPosition = sub(body.position, corePos);
  const relVelocity = sub(body.velocity, coreVel);
  const coreSeparation = Math.max(1e-9, Math.sqrt(magnitudeSquared(sub(bj.position, bk.position))));
  const farCoreRatio = Math.sqrt(magnitudeSquared(relPosition)) / coreSeparation;

  const relSpeedSq = magnitudeSquared(relVelocity);
  const softenedR = Math.sqrt(magnitudeSquared(relPosition) + params.softening * params.softening);
  const escapeSpeed = Math.sqrt((2 * params.G * mCore) / Math.max(1e-9, softenedR));
  const relSpeed = Math.sqrt(relSpeedSq);
  const speedRatioToEscape = relSpeed / Math.max(1e-9, escapeSpeed);
  const energy = 0.5 * relSpeedSq - (params.G * mCore) / Math.max(1e-9, softenedR);
  const radialDot = relVelocity.x * relPosition.x + relVelocity.y * relPosition.y;
  const outward = radialDot > 0;
  const outwardEnough = radialDot > relSpeed * Math.sqrt(magnitudeSquared(relPosition)) * MIN_OUTWARD_SPEED_RATIO;
  const strongEscape = speedRatioToEscape > 1 + ESCAPE_SPEED_MARGIN && outwardEnough;

  return {
    energy,
    outward,
    speedRatioToEscape,
    strongEscape,
    coreSeparation,
    farCoreRatio,
    coreIndices: [j, k],
    relPosition,
    relVelocity,
  };
};

export const evaluateEjection = (
  world: WorldState,
  params: SimParams,
): Pick<WorldState, "ejectionCounterById" | "ejectedBodyId" | "ejectedBodyIds" | "isRunning"> => {
  const updatedCounters: Record<string, number> = { ...world.ejectionCounterById };
  const knownEjected = new Set(world.ejectedBodyIds);
  let newlyEjectedBodyId: string | null = null;

  for (let i = 0; i < world.bodies.length; ++i) {
    const body = world.bodies[i];
    const metrics = coreEscapeMetricsForBody(i, world, params);
    if (!metrics) {
      continue;
    }
    const isPotentiallyEscaping =
      metrics.farCoreRatio > FAR_FIELD_RATIO_GATE &&
      metrics.energy > 0 &&
      metrics.strongEscape;

    const previous = updatedCounters[body.id] ?? 0;
    const next = isPotentiallyEscaping ? previous + Math.max(0, params.dt) : 0;
    updatedCounters[body.id] = next;

    if (next >= EJECTION_TIME_THRESHOLD_SECONDS) {
      const alreadyKnown = knownEjected.has(body.id);
      knownEjected.add(body.id);
      if (!alreadyKnown && newlyEjectedBodyId === null) {
        newlyEjectedBodyId = body.id;
      }
    }
  }

  const ejectedBodyIds = world.bodies
    .map((body) => body.id)
    .filter((id) => knownEjected.has(id));

  return {
    ejectionCounterById: updatedCounters,
    ejectedBodyId: newlyEjectedBodyId,
    ejectedBodyIds,
    isRunning: newlyEjectedBodyId ? false : world.isRunning,
  };
};
