import { coreEscapeMetricsForBody } from "./ejection";
import { computeAccelerations } from "./physics";
import type { BodyState, SimParams, Vec2, WorldState } from "./types";

export const DEFAULT_DISPLAY_PAIR_ENERGY_EPS = 0.05;

type PairBindingState = "dissolving" | "binary+single" | "resonant";

export type DisplayPairState = {
  nbound: number;
  state: PairBindingState;
};

export type BodyVectorSnapshot = {
  id: string;
  color: string;
  position: BodyState["position"];
  velocity: BodyState["velocity"];
  acceleration: Vec2;
};

export type BodyEjectionStatusSnapshot = {
  id: string;
  energy: number;
  speedRatioToEscape: number;
  farCoreRatio: number;
  outward: boolean;
  counter: number;
  threshold: number;
  isEjected: boolean;
};

export type EjectedBodyStatusBadge = {
  id: string;
  label: string;
  color: string;
};

const pairSpecificEnergyForBodies = (
  bodies: BodyState[],
  params: SimParams,
  i: number,
  j: number,
): number => {
  const bi = bodies[i];
  const bj = bodies[j];
  if (!bi || !bj) {
    return 0;
  }
  const dvx = bi.velocity.x - bj.velocity.x;
  const dvy = bi.velocity.y - bj.velocity.y;
  const vrel2 = dvx * dvx + dvy * dvy;
  const dx = bi.position.x - bj.position.x;
  const dy = bi.position.y - bj.position.y;
  const r = Math.sqrt(dx * dx + dy * dy + params.softening * params.softening);
  return 0.5 * vrel2 - (params.G * (bi.mass + bj.mass)) / Math.max(1e-9, r);
};

export const pairEnergiesForBodies = (bodies: BodyState[], params: SimParams) => {
  const eps12 = pairSpecificEnergyForBodies(bodies, params, 0, 1);
  const eps13 = pairSpecificEnergyForBodies(bodies, params, 0, 2);
  const eps23 = pairSpecificEnergyForBodies(bodies, params, 1, 2);
  return { eps12, eps13, eps23 };
};

export const pairBindingStateForBodies = (bodies: BodyState[], params: SimParams): PairBindingState => {
  const { eps12, eps13, eps23 } = pairEnergiesForBodies(bodies, params);
  const boundPairCount = [eps12, eps13, eps23].filter((energy) => energy < 0).length;
  return boundPairCount === 0
    ? "dissolving"
    : boundPairCount === 1
    ? "binary+single"
    : "resonant";
};

export const displayPairStateFromEnergies = (
  eps12: number,
  eps13: number,
  eps23: number,
  anyEjected: boolean,
  displayPairEnergyEps = DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
): DisplayPairState => {
  const nbound = [eps12, eps13, eps23].filter((energy) => energy < -displayPairEnergyEps).length;
  if (anyEjected && nbound > 0) {
    return { nbound, state: "binary+single" };
  }
  return {
    nbound,
    state: nbound === 0 ? "dissolving" : nbound === 1 ? "binary+single" : "resonant",
  };
};

export const boundPairStateLabel = (
  displayPairState: DisplayPairState,
  dissolutionDetected: boolean,
): "Dissolved" | "Dissolving" | "Binary+Single" | "Resonant" => {
  if (dissolutionDetected) {
    return "Dissolved";
  }
  return displayPairState.state === "dissolving"
    ? "Dissolving"
    : displayPairState.state === "binary+single"
    ? "Binary+Single"
    : "Resonant";
};

export const bodyVectorsForDisplay = (bodies: BodyState[], params: SimParams): BodyVectorSnapshot[] => {
  const accelerations = computeAccelerations(bodies, params);
  return bodies.map((body, index) => ({
    id: body.id,
    color: body.color,
    position: body.position,
    velocity: body.velocity,
    acceleration: accelerations[index],
  }));
};

export const bodyEjectionStatusesForDisplay = (
  world: WorldState,
  params: SimParams,
  ejectionThresholdSec: number,
): BodyEjectionStatusSnapshot[] =>
  world.bodies.map((body, index) => {
    const metrics = coreEscapeMetricsForBody(index, world, params);
    return {
      id: body.id,
      energy: metrics?.energy ?? 0,
      speedRatioToEscape: metrics?.speedRatioToEscape ?? 0,
      farCoreRatio: metrics?.farCoreRatio ?? 0,
      outward: metrics?.outward ?? false,
      counter: world.ejectionCounterById[body.id] ?? 0,
      threshold: ejectionThresholdSec,
      isEjected: world.ejectedBodyIds.includes(body.id),
    };
  });

export const ejectedBodiesForStatus = (
  world: WorldState,
  bodyColors: string[],
): EjectedBodyStatusBadge[] =>
  world.ejectedBodyIds.map((id) => {
    const idx = world.bodies.findIndex((body) => body.id === id);
    return {
      id,
      label: idx >= 0 ? `B${idx + 1}` : id,
      color: idx >= 0 ? bodyColors[idx] ?? "#d1d5db" : "#d1d5db",
    };
  });

export const latestEjectedLabelForStatus = (world: WorldState): string | null => {
  if (!world.ejectedBodyId) {
    return null;
  }
  const idx = world.bodies.findIndex((body) => body.id === world.ejectedBodyId);
  return idx >= 0 ? `B${idx + 1}` : world.ejectedBodyId;
};

export const statusLabelForWorld = (
  world: Pick<WorldState, "dissolutionDetected" | "isRunning" | "elapsedTime">,
  statusModeSegment: string,
  pairStateLabel: "Dissolved" | "Dissolving" | "Binary+Single" | "Resonant",
): string => {
  if (world.dissolutionDetected && !world.isRunning) {
    return "Dissolved";
  }
  if (world.isRunning) {
    return `Running • ${statusModeSegment} • ${pairStateLabel}`;
  }
  if (world.elapsedTime > 0) {
    return `Paused • ${statusModeSegment} • ${pairStateLabel}`;
  }
  return `Ready • ${statusModeSegment} • ${pairStateLabel}`;
};
