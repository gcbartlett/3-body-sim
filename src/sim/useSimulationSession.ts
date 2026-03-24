import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import { cloneBodies } from "./presets";
import { generateRandomChaoticBodies, generateRandomStableBodies } from "./randomProfiles";
import { applyDissolutionProgress, diagnosticsSnapshot } from "./simulationPolicies";
import {
  applyNewInitialStateTransition,
  runSingleStepTransition,
  runStartPauseTransition,
} from "./sessionTransitions";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./types";
import { useDraftEditPolicy, type DraftEditPolicyHandlers } from "./useDraftEditPolicy";

type UseSimulationSessionArgs = {
  session: {
    draftBodies: BodyState[];
    allPresets: PresetProfile[];
    selectedPresetId: string;
    bodyColors: readonly string[];
  };
  runtimeRefs: {
    worldRef: RefObject<WorldState>;
    paramsRef: RefObject<SimParams>;
    trailsRef: RefObject<TrailMap>;
    accumulatorRef: RefObject<number>;
    lastTimeRef: RefObject<number | null>;
    simStepCounterRef: RefObject<number>;
  };
  stateSetters: {
    setWorld: Dispatch<SetStateAction<WorldState>>;
    setParams: Dispatch<SetStateAction<SimParams>>;
    setDraftBodies: Dispatch<SetStateAction<BodyState[]>>;
    setBaselineDiagnostics: Dispatch<SetStateAction<DiagnosticsSnapshot>>;
  };
  controls: {
    setManualMode: (enabled: boolean) => void;
    scheduleFastReframe: () => void;
  };
};

type SimulationSessionHandlers = DraftEditPolicyHandlers & {
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onApplyPreset: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const useSimulationSession = ({
  session,
  runtimeRefs,
  stateSetters,
  controls,
}: UseSimulationSessionArgs): SimulationSessionHandlers => {
  const { draftBodies, allPresets, selectedPresetId, bodyColors } = session;
  const { worldRef, paramsRef, trailsRef, accumulatorRef, lastTimeRef, simStepCounterRef } = runtimeRefs;
  const { setWorld, setParams, setDraftBodies, setBaselineDiagnostics } = stateSetters;
  const { setManualMode, scheduleFastReframe } = controls;

  const { onBodyChange, onParamChange, onResetParams } = useDraftEditPolicy({
    worldRef,
    paramsRef,
    setWorld,
    setParams,
    setDraftBodies,
    setBaselineDiagnostics,
  });

  const newInitialStateDeps = {
    worldRef,
    trailsRef,
    simStepCounterRef,
    setWorld,
    setBaselineDiagnostics,
  };
  const startPauseDeps = {
    worldRef,
    paramsRef,
    setWorld,
    setBaselineDiagnostics,
  };
  const singleStepDeps = {
    worldRef,
    paramsRef,
    trailsRef,
    setWorld,
  };

  const applyBodiesAsNewInitialState = (nextBodies: BodyState[]) => {
    setDraftBodies(nextBodies);
    applyNewInitialStateTransition(newInitialStateDeps, nextBodies, paramsRef.current, diagnosticsSnapshot);
    scheduleFastReframe();
  };

  const onStartPause = () => {
    runStartPauseTransition(startPauseDeps, diagnosticsSnapshot);
  };

  const onReset = () => {
    accumulatorRef.current = 0;
    lastTimeRef.current = null;
    setManualMode(false);
    scheduleFastReframe();
    applyNewInitialStateTransition(newInitialStateDeps, draftBodies, paramsRef.current, diagnosticsSnapshot);
  };

  const onStep = () => {
    runSingleStepTransition(singleStepDeps, applyDissolutionProgress);
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
    applyNewInitialStateTransition(newInitialStateDeps, nextBodies, nextParams, diagnosticsSnapshot);
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
    onBodyChange,
    onParamChange,
    onResetParams,
    onStartPause,
    onReset,
    onStep,
    onApplyPreset,
    onGenerateRandomStable,
    onGenerateRandomChaotic,
  };
};
