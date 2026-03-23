import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import { cloneBodies } from "./presets";
import { generateRandomChaoticBodies, generateRandomStableBodies } from "./randomProfiles";
import {
  appendTrailPoints,
  applyDissolutionProgress,
  diagnosticsSnapshot,
} from "./simulationPolicies";
import {
  buildNewInitialStateTransition,
  buildSingleStepTransition,
  buildStartPauseTransition,
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
