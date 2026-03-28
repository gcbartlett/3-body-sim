import type { Dispatch, RefObject, SetStateAction } from "react";
import type { TrailMap } from "../render/canvasRenderer";
import type { SimulationHistory } from "./simulationHistory";
import { applyDissolutionProgress, diagnosticsSnapshot } from "./simulationPolicies";
import {
  applyNewInitialStateTransition,
  runSingleStepWithHistoryTransition,
  runStepBackTransition,
  runStartPauseTransition,
} from "./sessionTransitions";
import type { BodyState, DiagnosticsSnapshot, PresetProfile, SimParams, WorldState } from "./types";
import { useDraftEditPolicy, type DraftEditPolicyHandlers } from "./useDraftEditPolicy";
import { useSessionPresetCommands } from "./useSessionPresetCommands";

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
    forceFastZoomInFramesRef: RefObject<number>;
    hoverLastUpdateTimeRef: RefObject<number>;
    historyRef: RefObject<SimulationHistory>;
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
    onHistoryChanged?: (depth: number) => void;
  };
};

type SimulationSessionHandlers = DraftEditPolicyHandlers & {
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack: () => void;
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
  const {
    worldRef,
    paramsRef,
    trailsRef,
    accumulatorRef,
    lastTimeRef,
    simStepCounterRef,
    forceFastZoomInFramesRef,
    hoverLastUpdateTimeRef,
    historyRef,
  } = runtimeRefs;
  const { setWorld, setParams, setDraftBodies, setBaselineDiagnostics } = stateSetters;
  const { setManualMode, scheduleFastReframe, onHistoryChanged } = controls;

  const { onBodyChange, onParamChange, onResetParams } = useDraftEditPolicy({
    worldRef,
    paramsRef,
    historyRef,
    onHistoryChanged,
    setWorld,
    setParams,
    setDraftBodies,
    setBaselineDiagnostics,
  });

  const newInitialStateDeps = {
    worldRef,
    trailsRef,
    simStepCounterRef,
    historyRef,
    onHistoryChanged,
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
    accumulatorRef,
    simStepCounterRef,
    forceFastZoomInFramesRef,
    historyRef,
    onHistoryChanged,
    setWorld,
  };
  const stepBackDeps = {
    worldRef,
    accumulatorRef,
    simStepCounterRef,
    forceFastZoomInFramesRef,
    trailsRef,
    lastTimeRef,
    hoverLastUpdateTimeRef,
    historyRef,
    onHistoryChanged,
    setWorld,
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
    runSingleStepWithHistoryTransition(singleStepDeps, applyDissolutionProgress);
  };

  const onStepBack = () => {
    runStepBackTransition(stepBackDeps);
  };
  const { onApplyPreset, onGenerateRandomStable, onGenerateRandomChaotic } =
    useSessionPresetCommands({
      session: {
        allPresets,
        selectedPresetId,
        bodyColors,
      },
      refs: {
        paramsRef,
      },
      stateSetters: {
        setParams,
        setDraftBodies,
      },
      transitions: {
        newInitialStateDeps,
        scheduleFastReframe,
      },
    });

  return {
    onBodyChange,
    onParamChange,
    onResetParams,
    onStartPause,
    onReset,
    onStep,
    onStepBack,
    onApplyPreset,
    onGenerateRandomStable,
    onGenerateRandomChaotic,
  };
};
