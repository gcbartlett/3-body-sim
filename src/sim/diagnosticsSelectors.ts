import { coreEscapeMetricsForBody } from "./ejection";
import { computeAccelerations } from "./physics";
import type { BodyState, DiagnosticsSnapshot, SimParams, Vec2, WorldState } from "./types";

export const DEFAULT_DISPLAY_PAIR_ENERGY_EPS = 0.05;

export type PairBindingState = "dissolving" | "binary+single" | "resonant";

export type DisplayPairState = {
  nbound: number;
  state: PairBindingState;
};

export type DisplayPairStateWithEps = DisplayPairState & { eps: number };

export type PairEnergyDisplay = {
  eps12: number;
  eps13: number;
  eps23: number;
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

export type DiagnosticsDriftMetrics = {
  deltaEnergy: number;
  energyDriftPct: number;
  deltaMomentumMag: number;
  momentumDriftPct: number;
};

type StageDiagnosticsViewModelInput = {
  world: WorldState;
  params: SimParams;
  ejectionThresholdSec: number;
  displayPairEnergyEps?: number;
};

export type StageDiagnosticsViewModel = {
  pairEnergies: PairEnergyDisplay;
  displayPairState: DisplayPairStateWithEps;
  bodyVectors: BodyVectorSnapshot[];
  bodyEjectionStatuses: BodyEjectionStatusSnapshot[];
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

export const pairEnergiesForBodies = (bodies: BodyState[], params: SimParams): PairEnergyDisplay => {
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

export const diagnosticsDriftMetrics = (
  diagnostics: DiagnosticsSnapshot,
  baselineDiagnostics: DiagnosticsSnapshot,
): DiagnosticsDriftMetrics => {
  const deltaEnergy = diagnostics.energy - baselineDiagnostics.energy;
  const energyDriftPct = (Math.abs(deltaEnergy) / Math.max(1e-9, Math.abs(baselineDiagnostics.energy))) * 100;
  const deltaMomentumX = diagnostics.momentum.x - baselineDiagnostics.momentum.x;
  const deltaMomentumY = diagnostics.momentum.y - baselineDiagnostics.momentum.y;
  const deltaMomentumMag = Math.hypot(deltaMomentumX, deltaMomentumY);
  const baselineMomentumMag = Math.hypot(
    baselineDiagnostics.momentum.x,
    baselineDiagnostics.momentum.y,
  );
  const momentumDriftPct = (deltaMomentumMag / Math.max(1e-9, baselineMomentumMag)) * 100;
  return {
    deltaEnergy,
    energyDriftPct,
    deltaMomentumMag,
    momentumDriftPct,
  };
};

export const stageDiagnosticsViewModelForWorld = ({
  world,
  params,
  ejectionThresholdSec,
  displayPairEnergyEps = DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
}: StageDiagnosticsViewModelInput): StageDiagnosticsViewModel => {
  const pairEnergies = pairEnergiesForBodies(world.bodies, params);
  return {
    pairEnergies,
    displayPairState: {
      ...displayPairStateFromEnergies(
        pairEnergies.eps12,
        pairEnergies.eps13,
        pairEnergies.eps23,
        world.ejectedBodyIds.length > 0,
        displayPairEnergyEps,
      ),
      eps: displayPairEnergyEps,
    },
    bodyVectors: bodyVectorsForDisplay(world.bodies, params),
    bodyEjectionStatuses: bodyEjectionStatusesForDisplay(world, params, ejectionThresholdSec),
  };
};
