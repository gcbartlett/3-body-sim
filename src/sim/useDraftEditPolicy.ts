import type { Dispatch, RefObject, SetStateAction } from "react";
import { defaultParams } from "./defaults";
import { clearHistory, getHistorySnapshotCount, type SimulationHistory } from "./simulationHistory";
import {
  applyBodyField,
  diagnosticsSnapshot,
  type BodyEditField,
} from "./simulationPolicies";
import type { BodyState, DiagnosticsSnapshot, SimParams, WorldState } from "./types";
import { createStoppedWorld } from "./worldState";

type UseDraftEditPolicyArgs = {
  worldRef: RefObject<WorldState>;
  paramsRef: RefObject<SimParams>;
  historyRef: RefObject<SimulationHistory>;
  onHistoryChanged?: (depth: number) => void;
  setWorld: Dispatch<SetStateAction<WorldState>>;
  setParams: Dispatch<SetStateAction<SimParams>>;
  setDraftBodies: Dispatch<SetStateAction<BodyState[]>>;
  setBaselineDiagnostics: Dispatch<SetStateAction<DiagnosticsSnapshot>>;
};

export type DraftEditPolicyHandlers = {
  onBodyChange: (index: number, field: BodyEditField, value: number) => void;
  onParamChange: (field: keyof SimParams, value: number) => void;
  onResetParams: () => void;
};

export const useDraftEditPolicy = ({
  worldRef,
  paramsRef,
  historyRef,
  onHistoryChanged,
  setWorld,
  setParams,
  setDraftBodies,
  setBaselineDiagnostics,
}: UseDraftEditPolicyArgs): DraftEditPolicyHandlers => {
  const shouldSyncDraftEditsToStoppedWorld = (candidateWorld: WorldState) =>
    !candidateWorld.isRunning && candidateWorld.elapsedTime === 0;

  const syncStoppedWorldAndBaseline = (nextBodies: BodyState[], nextParams: SimParams) => {
    const synced = createStoppedWorld(nextBodies);
    worldRef.current = synced;
    setWorld(synced);
    setBaselineDiagnostics(diagnosticsSnapshot(synced.bodies, nextParams));
    clearHistory(historyRef);
    onHistoryChanged?.(getHistorySnapshotCount(historyRef.current));
  };

  const onBodyChange = (index: number, field: BodyEditField, value: number) => {
    setDraftBodies((prev) => {
      const next = prev.map((body, i) => (i === index ? applyBodyField(body, field, value) : body));
      if (shouldSyncDraftEditsToStoppedWorld(worldRef.current)) {
        syncStoppedWorldAndBaseline(next, paramsRef.current);
      }
      return next;
    });
  };

  const onParamChange = (field: keyof SimParams, value: number) => {
    if (!Number.isFinite(value)) {
      return;
    }
    const next = { ...paramsRef.current, [field]: value };
    paramsRef.current = next;
    setParams(next);
    if (shouldSyncDraftEditsToStoppedWorld(worldRef.current)) {
      setBaselineDiagnostics(diagnosticsSnapshot(worldRef.current.bodies, next));
      clearHistory(historyRef);
      onHistoryChanged?.(getHistorySnapshotCount(historyRef.current));
    }
  };

  const onResetParams = () => {
    const next = defaultParams();
    paramsRef.current = next;
    setParams(next);
    if (shouldSyncDraftEditsToStoppedWorld(worldRef.current)) {
      setBaselineDiagnostics(diagnosticsSnapshot(worldRef.current.bodies, next));
      clearHistory(historyRef);
      onHistoryChanged?.(getHistorySnapshotCount(historyRef.current));
    }
  };

  return {
    onBodyChange,
    onParamChange,
    onResetParams,
  };
};
