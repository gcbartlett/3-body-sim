import type { TrailMap } from "../render/canvasRenderer";
import { totalEnergy, totalMomentum } from "./physics";
import { pairBindingStateForBodies } from "./diagnosticsSelectors";
import type { BodyState, DiagnosticsSnapshot, SimParams, WorldState } from "./types";

export type BodyEditField = "mass" | "position.x" | "position.y" | "velocity.x" | "velocity.y";

const MAX_TRAIL_POINTS_PER_BODY = 2400;
export const DISSOLUTION_TIME_THRESHOLD_SECONDS = 10;
const MIN_SIMULATION_SPEED = 0.01;
const MAX_SIMULATION_SPEED = 30;
const SIMULATION_SPEED_DECIMAL_PLACES = 3;

export const applyBodyField = (
  body: BodyState,
  field: BodyEditField,
  value: number,
): BodyState => {
  if (field === "mass") {
    return { ...body, mass: Math.max(0.001, value) };
  }
  if (field === "position.x") {
    return { ...body, position: { ...body.position, x: value } };
  }
  if (field === "position.y") {
    return { ...body, position: { ...body.position, y: value } };
  }
  if (field === "velocity.x") {
    return { ...body, velocity: { ...body.velocity, x: value } };
  }
  return { ...body, velocity: { ...body.velocity, y: value } };
};

export const diagnosticsSnapshot = (bodies: BodyState[], params: SimParams): DiagnosticsSnapshot => ({
  energy: totalEnergy(bodies, params),
  momentum: totalMomentum(bodies),
});

export const appendTrailPoints = (trails: TrailMap, bodies: BodyState[]): TrailMap => {
  const updated: TrailMap = { ...trails };
  for (const body of bodies) {
    const existing = updated[body.id] ?? [];
    const next = [...existing, { x: body.position.x, y: body.position.y, life: 1 }];
    updated[body.id] =
      next.length > MAX_TRAIL_POINTS_PER_BODY
        ? next.slice(next.length - MAX_TRAIL_POINTS_PER_BODY)
        : next;
  }
  return updated;
};

export const applyDissolutionProgress = (
  baseWorld: WorldState,
  stepParams: SimParams,
  stepDt: number,
): WorldState => {
  const pairState = pairBindingStateForBodies(baseWorld.bodies, stepParams);
  const nextCounterSec =
    pairState === "dissolving" ? baseWorld.dissolutionCounterSec + Math.max(0, stepDt) : 0;
  const crossedThreshold =
    !baseWorld.dissolutionDetected && nextCounterSec >= DISSOLUTION_TIME_THRESHOLD_SECONDS;
  return {
    ...baseWorld,
    dissolutionCounterSec: nextCounterSec,
    dissolutionDetected: baseWorld.dissolutionDetected || crossedThreshold,
    dissolutionJustDetected: crossedThreshold ? true : baseWorld.dissolutionJustDetected,
    isRunning: crossedThreshold ? false : baseWorld.isRunning,
  };
};

export const adjustedSimulationSpeed = (currentSpeed: number, factor: number): number =>
  Math.max(
    MIN_SIMULATION_SPEED,
    Math.min(
      MAX_SIMULATION_SPEED,
      Number((currentSpeed * factor).toFixed(SIMULATION_SPEED_DECIMAL_PLACES)),
    ),
  );
