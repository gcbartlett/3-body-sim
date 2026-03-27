import type { Dispatch, RefObject, SetStateAction } from "react";
import { cloneBodies } from "./presets";
import { generateRandomChaoticBodies, generateRandomStableBodies } from "./randomProfiles";
import { diagnosticsSnapshot } from "./simulationPolicies";
import {
  applyNewInitialStateTransition,
  type NewInitialStateTransitionDeps,
} from "./sessionTransitions";
import type { BodyState, PresetProfile, SimParams } from "./types";

type SessionPresetCommandArgs = {
  session: {
    allPresets: PresetProfile[];
    selectedPresetId: string;
    bodyColors: readonly string[];
  };
  refs: {
    paramsRef: RefObject<SimParams>;
  };
  stateSetters: {
    setParams: Dispatch<SetStateAction<SimParams>>;
    setDraftBodies: Dispatch<SetStateAction<BodyState[]>>;
  };
  transitions: {
    newInitialStateDeps: NewInitialStateTransitionDeps;
    scheduleFastReframe: () => void;
  };
};

type SessionPresetCommandHandlers = {
  onApplyPreset: () => void;
  onGenerateRandomStable: () => void;
  onGenerateRandomChaotic: () => void;
};

export const useSessionPresetCommands = ({
  session,
  refs,
  stateSetters,
  transitions,
}: SessionPresetCommandArgs): SessionPresetCommandHandlers => {
  const { allPresets, selectedPresetId, bodyColors } = session;
  const { paramsRef } = refs;
  const { setParams, setDraftBodies } = stateSetters;
  const { newInitialStateDeps, scheduleFastReframe } = transitions;

  const applyBodiesAsNewInitialState = (nextBodies: BodyState[]) => {
    setDraftBodies(nextBodies);
    applyNewInitialStateTransition(
      newInitialStateDeps,
      nextBodies,
      paramsRef.current,
      diagnosticsSnapshot,
    );
    scheduleFastReframe();
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
    onApplyPreset,
    onGenerateRandomStable,
    onGenerateRandomChaotic,
  };
};
