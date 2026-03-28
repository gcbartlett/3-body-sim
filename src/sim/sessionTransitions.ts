import type { Dispatch, RefObject, SetStateAction } from "react";
import { fadeAndPruneTrails, type TrailMap } from "../render/canvasRenderer";
import { evaluateEjection } from "./ejection";
import { velocityVerletStep } from "./integrators";
import {
  captureSnapshot,
  clearHistory,
  popSnapshot,
  pushSnapshot,
  restoreSnapshot,
  type SimulationHistory,
} from "./simulationHistory";
import { appendTrailPoints } from "./simulationPolicies";
import type { BodyState, DiagnosticsSnapshot, SimParams, WorldState } from "./types";
import { createStoppedWorld } from "./worldState";

type DiagnosticsComputer = (bodies: BodyState[], params: SimParams) => DiagnosticsSnapshot;

export type NewInitialStateTransition = {
  nextWorld: WorldState;
  baselineDiagnostics: DiagnosticsSnapshot;
};

export const buildNewInitialStateTransition = (
  nextBodies: BodyState[],
  nextParams: SimParams,
  computeDiagnostics: DiagnosticsComputer,
): NewInitialStateTransition => {
  const nextWorld = createStoppedWorld(nextBodies);
  return {
    nextWorld,
    baselineDiagnostics: computeDiagnostics(nextWorld.bodies, nextParams),
  };
};

export type NewInitialStateTransitionDeps = {
  worldRef: RefObject<WorldState>;
  trailsRef: RefObject<TrailMap>;
  simStepCounterRef: RefObject<number>;
  historyRef: RefObject<SimulationHistory>;
  onHistoryChanged?: (depth: number) => void;
  setWorld: Dispatch<SetStateAction<WorldState>>;
  setBaselineDiagnostics: Dispatch<SetStateAction<DiagnosticsSnapshot>>;
};

export const applyNewInitialStateTransition = (
  deps: NewInitialStateTransitionDeps,
  nextBodies: BodyState[],
  nextParams: SimParams,
  computeDiagnostics: DiagnosticsComputer,
): void => {
  const transition = buildNewInitialStateTransition(nextBodies, nextParams, computeDiagnostics);
  deps.worldRef.current = transition.nextWorld;
  deps.setWorld(transition.nextWorld);
  deps.setBaselineDiagnostics(transition.baselineDiagnostics);
  deps.trailsRef.current = {};
  deps.simStepCounterRef.current = 0;
  clearHistory(deps.historyRef);
  deps.onHistoryChanged?.(deps.historyRef.current.snapshots.length);
};

export type StartPauseTransition = {
  nextWorld: WorldState;
  baselineDiagnostics: DiagnosticsSnapshot | null;
};

export const buildStartPauseTransition = (
  currentWorld: WorldState,
  params: SimParams,
  computeDiagnostics: DiagnosticsComputer,
): StartPauseTransition => {
  let nextWorld: WorldState = { ...currentWorld, isRunning: !currentWorld.isRunning };
  const baselineDiagnostics =
    !currentWorld.isRunning && currentWorld.elapsedTime === 0
      ? computeDiagnostics(currentWorld.bodies, params)
      : null;

  if (!currentWorld.isRunning && currentWorld.ejectedBodyId) {
    nextWorld = { ...nextWorld, ejectedBodyId: null };
  }
  if (!currentWorld.isRunning && currentWorld.dissolutionJustDetected) {
    nextWorld = { ...nextWorld, dissolutionJustDetected: false };
  }

  return { nextWorld, baselineDiagnostics };
};

export type StartPauseTransitionDeps = {
  worldRef: RefObject<WorldState>;
  paramsRef: RefObject<SimParams>;
  setWorld: Dispatch<SetStateAction<WorldState>>;
  setBaselineDiagnostics: Dispatch<SetStateAction<DiagnosticsSnapshot>>;
};

export const runStartPauseTransition = (
  deps: StartPauseTransitionDeps,
  computeDiagnostics: DiagnosticsComputer,
): void => {
  deps.setWorld((prev) => {
    const transition = buildStartPauseTransition(prev, deps.paramsRef.current, computeDiagnostics);
    if (transition.baselineDiagnostics) {
      deps.setBaselineDiagnostics(transition.baselineDiagnostics);
    }
    deps.worldRef.current = transition.nextWorld;
    return transition.nextWorld;
  });
};

export const buildSingleStepTransition = (
  currentWorld: WorldState,
  params: SimParams,
  applyDissolutionProgress: (world: WorldState, stepParams: SimParams, dt: number) => WorldState,
): WorldState => {
  const steppedBodies = velocityVerletStep(currentWorld.bodies, params);
  let nextWorld: WorldState = {
    ...currentWorld,
    bodies: steppedBodies,
    elapsedTime: currentWorld.elapsedTime + params.dt,
    isRunning: false,
  };
  const ejection = evaluateEjection(nextWorld, params);
  nextWorld = {
    ...nextWorld,
    ejectionCounterById: ejection.ejectionCounterById,
    ejectedBodyId: ejection.ejectedBodyId,
    ejectedBodyIds: ejection.ejectedBodyIds,
    isRunning: false,
  };
  return applyDissolutionProgress(nextWorld, params, params.dt);
};

export type SingleStepTransitionDeps = {
  worldRef: RefObject<WorldState>;
  paramsRef: RefObject<SimParams>;
  trailsRef: RefObject<TrailMap>;
  setWorld: Dispatch<SetStateAction<WorldState>>;
};

export const runSingleStepTransition = (
  deps: SingleStepTransitionDeps,
  applyDissolutionProgress: (world: WorldState, stepParams: SimParams, dt: number) => WorldState,
): void => {
  const nextWorld = buildSingleStepTransition(
    deps.worldRef.current,
    deps.paramsRef.current,
    applyDissolutionProgress,
  );
  deps.worldRef.current = nextWorld;
  deps.setWorld(nextWorld);
  const sampledTrails = appendTrailPoints(deps.trailsRef.current, nextWorld.bodies);
  deps.trailsRef.current = fadeAndPruneTrails(sampledTrails, deps.paramsRef.current.trailFade);
};

export type SingleStepWithHistoryTransitionDeps = SingleStepTransitionDeps & {
  accumulatorRef: RefObject<number>;
  simStepCounterRef: RefObject<number>;
  forceFastZoomInFramesRef: RefObject<number>;
  historyRef: RefObject<SimulationHistory>;
  onHistoryChanged?: (depth: number) => void;
};

export const runSingleStepWithHistoryTransition = (
  deps: SingleStepWithHistoryTransitionDeps,
  applyDissolutionProgress: (world: WorldState, stepParams: SimParams, dt: number) => WorldState,
): void => {
  pushSnapshot(
    deps.historyRef,
    captureSnapshot({
      world: deps.worldRef.current,
      trails: deps.trailsRef.current,
      accumulator: deps.accumulatorRef.current,
      simStepCounter: deps.simStepCounterRef.current,
      forceFastZoomInFrames: deps.forceFastZoomInFramesRef.current,
    }),
  );
  deps.onHistoryChanged?.(deps.historyRef.current.snapshots.length);
  runSingleStepTransition(deps, applyDissolutionProgress);
};

export type StepBackTransitionDeps = {
  worldRef: RefObject<WorldState>;
  accumulatorRef: RefObject<number>;
  simStepCounterRef: RefObject<number>;
  forceFastZoomInFramesRef: RefObject<number>;
  trailsRef: RefObject<TrailMap>;
  lastTimeRef: RefObject<number | null>;
  hoverLastUpdateTimeRef: RefObject<number>;
  historyRef: RefObject<SimulationHistory>;
  onHistoryChanged?: (depth: number) => void;
  setWorld: Dispatch<SetStateAction<WorldState>>;
};

export const runStepBackTransition = (deps: StepBackTransitionDeps): boolean => {
  const snapshot = popSnapshot(deps.historyRef);
  if (!snapshot) {
    return false;
  }
  deps.onHistoryChanged?.(deps.historyRef.current.snapshots.length);

  const restored = restoreSnapshot({ snapshot });
  deps.worldRef.current = restored.world;
  deps.accumulatorRef.current = restored.accumulator;
  deps.simStepCounterRef.current = restored.simStepCounter;
  deps.forceFastZoomInFramesRef.current = restored.forceFastZoomInFrames;
  deps.trailsRef.current = restored.trails;
  deps.lastTimeRef.current = null;
  deps.hoverLastUpdateTimeRef.current = 0;
  deps.setWorld(restored.world);
  return true;
};
