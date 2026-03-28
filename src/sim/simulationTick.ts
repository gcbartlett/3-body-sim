import type { TrailMap } from "../render/canvasRenderer";
import { evaluateEjection } from "./ejection";
import { velocityVerletStep } from "./integrators";
import type { BodyState, SimParams, WorldState } from "./types";

const BASE_MAX_STEPS = 12;
const MAX_DT_SCALE = 6;
const SPEED_DT_LOG_MULTIPLIER = 2.3;
const SPEED_LOG_BASELINE = 1;
const MAX_STEPS_PER_FRAME_CAP = 240;
const MAX_TRAIL_SAMPLE_EVERY = 45;

type AdvanceWorldStepArgs = {
  currentWorld: WorldState;
  currentParams: SimParams;
  dtReal: number;
  accumulator: number;
  trails: TrailMap;
  simStepCounter: number;
  appendTrailPoints: (trails: TrailMap, bodies: BodyState[]) => TrailMap;
  applyDissolutionProgress: (world: WorldState, params: SimParams, dt: number) => WorldState;
};

export type AdvanceWorldStepResult = {
  nextWorld: WorldState;
  nextAccumulator: number;
  nextTrails: TrailMap;
  nextSimStepCounter: number;
  worldChanged: boolean;
};

const computeSteppingPolicy = (params: SimParams) => {
  const rate = params.speed;
  const dtScale =
    rate <= 1
      ? 1
      : Math.min(
          MAX_DT_SCALE,
          1 + Math.log10(Math.max(SPEED_LOG_BASELINE, rate)) * SPEED_DT_LOG_MULTIPLIER,
        );
  const effectiveDt = params.dt * dtScale;
  const maxStepsThisFrame = Math.max(
    BASE_MAX_STEPS,
    Math.min(MAX_STEPS_PER_FRAME_CAP, Math.floor(BASE_MAX_STEPS + 20 * Math.sqrt(rate))),
  );
  const trailSampleEvery = Math.max(1, Math.min(MAX_TRAIL_SAMPLE_EVERY, Math.floor(rate)));
  return { rate, effectiveDt, maxStepsThisFrame, trailSampleEvery };
};

export const effectiveSimulationDt = (params: SimParams): number =>
  computeSteppingPolicy(params).effectiveDt;

export const advanceRunningWorldStep = ({
  currentWorld,
  currentParams,
  dtReal,
  accumulator,
  trails,
  simStepCounter,
  appendTrailPoints,
  applyDissolutionProgress,
}: AdvanceWorldStepArgs): AdvanceWorldStepResult => {
  if (!currentWorld.isRunning) {
    return {
      nextWorld: currentWorld,
      nextAccumulator: accumulator,
      nextTrails: trails,
      nextSimStepCounter: simStepCounter,
      worldChanged: false,
    };
  }

  const policy = computeSteppingPolicy(currentParams);
  const stepParams = { ...currentParams, dt: policy.effectiveDt };

  let nextWorld = currentWorld;
  let nextAccumulator = accumulator + dtReal * policy.rate;
  let nextTrails = trails;
  let nextSimStepCounter = simStepCounter;
  let stepCount = 0;

  while (nextAccumulator >= policy.effectiveDt && stepCount < policy.maxStepsThisFrame) {
    const steppedBodies = velocityVerletStep(nextWorld.bodies, stepParams);
    nextSimStepCounter += 1;
    if (nextSimStepCounter % policy.trailSampleEvery === 0) {
      nextTrails = appendTrailPoints(nextTrails, steppedBodies);
    }

    nextWorld = {
      ...nextWorld,
      bodies: steppedBodies,
      elapsedTime: nextWorld.elapsedTime + policy.effectiveDt,
    };
    const ejection = evaluateEjection(nextWorld, stepParams);
    nextWorld = {
      ...nextWorld,
      ejectionCounterById: ejection.ejectionCounterById,
      ejectedBodyId: ejection.ejectedBodyId,
      ejectedBodyIds: ejection.ejectedBodyIds,
      isRunning: ejection.isRunning,
    };
    nextWorld = applyDissolutionProgress(nextWorld, stepParams, policy.effectiveDt);
    nextAccumulator -= policy.effectiveDt;
    stepCount += 1;
    if (!nextWorld.isRunning) {
      break;
    }
  }

  const maxBacklog = policy.effectiveDt * policy.maxStepsThisFrame;
  if (nextAccumulator > maxBacklog) {
    nextAccumulator = maxBacklog;
  }

  return {
    nextWorld,
    nextAccumulator,
    nextTrails,
    nextSimStepCounter,
    worldChanged: nextWorld !== currentWorld,
  };
};
