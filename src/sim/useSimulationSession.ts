import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import { cloneBodies } from "./presets";
import { generateRandomChaoticBodies, generateRandomStableBodies } from "./randomProfiles";
import {
  buildNewInitialStateTransition,
  buildSingleStepTransition,
  buildStartPauseTransition,
} from "./sessionTransitions";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./types";

type UseSimulationSessionArgs = {
  draftBodies: BodyState[];
  allPresets: PresetProfile[];
  selectedPresetId: string;
  bodyColors: readonly string[];
  worldRef: MutableRefObject<WorldState>;
  paramsRef: MutableRefObject<SimParams>;
  trailsRef: MutableRefObject<TrailMap>;
  accumulatorRef: MutableRefObject<number>;
  lastTimeRef: MutableRefObject<number | null>;
  simStepCounterRef: MutableRefObject<number>;
  setWorld: Dispatch<SetStateAction<WorldState>>;
  setParams: Dispatch<SetStateAction<SimParams>>;
  setDraftBodies: Dispatch<SetStateAction<BodyState[]>>;
  setBaselineDiagnostics: Dispatch<SetStateAction<DiagnosticsSnapshot>>;
  setManualMode: (enabled: boolean) => void;
  scheduleFastReframe: () => void;
  appendTrailPoints: (trails: TrailMap, bodies: BodyState[]) => TrailMap;
  applyDissolutionProgress: (world: WorldState, stepParams: SimParams, dt: number) => WorldState;
  diagnosticsSnapshot: (bodies: BodyState[], params: SimParams) => DiagnosticsSnapshot;
};

type SimulationSessionHandlers = {
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onApplyPreset: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const useSimulationSession = ({
  draftBodies,
  allPresets,
  selectedPresetId,
  bodyColors,
  worldRef,
  paramsRef,
  trailsRef,
  accumulatorRef,
  lastTimeRef,
  simStepCounterRef,
  setWorld,
  setParams,
  setDraftBodies,
  setBaselineDiagnostics,
  setManualMode,
  scheduleFastReframe,
  appendTrailPoints,
  applyDissolutionProgress,
  diagnosticsSnapshot,
}: UseSimulationSessionArgs): SimulationSessionHandlers => {
  const applyNewInitialStateTransition = (nextBodies: BodyState[], nextParams: SimParams) => {
    const transition = buildNewInitialStateTransition(nextBodies, nextParams, diagnosticsSnapshot);
    worldRef.current = transition.nextWorld;
    setWorld(transition.nextWorld);
    setBaselineDiagnostics(transition.baselineDiagnostics);
    trailsRef.current = {};
    simStepCounterRef.current = 0;
  };

  const applyBodiesAsNewInitialState = (nextBodies: BodyState[]) => {
    setDraftBodies(nextBodies);
    applyNewInitialStateTransition(nextBodies, paramsRef.current);
    scheduleFastReframe();
  };

  const onStartPause = () => {
    setWorld((prev) => {
      const transition = buildStartPauseTransition(prev, paramsRef.current, diagnosticsSnapshot);
      if (transition.baselineDiagnostics) {
        setBaselineDiagnostics(transition.baselineDiagnostics);
      }
      worldRef.current = transition.nextWorld;
      return transition.nextWorld;
    });
  };

  const onReset = () => {
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    setManualMode(false);
    scheduleFastReframe();
    applyNewInitialStateTransition(draftBodies, paramsRef.current);
  };

  const onStep = () => {
    const nextWorld = buildSingleStepTransition(
      worldRef.current,
      paramsRef.current,
      applyDissolutionProgress,
    );
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    trailsRef.current = appendTrailPoints(trailsRef.current, nextWorld.bodies);
  };

  const onApplyPreset = () => {
    const preset = allPresets.find((candidate) => candidate.id === selectedPresetId);
    if (!preset) {
      return;
    }

    const nextBodies = cloneBodies(preset.bodies);
    const nextParams = { ...paramsRef.current, ...preset.params };
    setDraftBodies(nextBodies);
    setParams(nextParams);
    paramsRef.current = nextParams;
    applyNewInitialStateTransition(nextBodies, nextParams);
    scheduleFastReframe();
  };

  const onGenerateRandomStable = () => {
    const nextBodies = generateRandomStableBodies([...bodyColors]);
    const nextParams = { ...paramsRef.current, G: 1, dt: 0.0045, speed: 1 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

  const onGenerateRandomChaotic = () => {
    const nextBodies = generateRandomChaoticBodies([...bodyColors]);
    const nextParams = { ...paramsRef.current, G: 1.1, dt: 0.005, speed: 1.3 };
    paramsRef.current = nextParams;
    setParams(nextParams);
    applyBodiesAsNewInitialState(nextBodies);
  };

  return {
    onStartPause,
    onReset,
    onStep,
    onApplyPreset,
    onGenerateRandomStable,
    onGenerateRandomChaotic,
  };
};
