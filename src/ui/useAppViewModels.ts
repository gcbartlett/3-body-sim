import type { ComponentProps } from "react";
import { EJECTION_TIME_THRESHOLD_SECONDS } from "../sim/ejection";
import { stageDiagnosticsViewModelForWorld } from "../sim/diagnosticsSelectors";
import { DISSOLUTION_TIME_THRESHOLD_SECONDS } from "../sim/simulationPolicies";
import { boundPairStateLabel, stageViewModelForWorld } from "../sim/stageSelectors";
import type { DiagnosticsSnapshot, LockMode, SimParams, WorldState } from "../sim/types";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { StageControls } from "./stage/StageControls";
import { StageHud } from "./stage/StageHud";

type UseAppViewModelsInput = {
  world: WorldState;
  params: SimParams;
  panelExpanded: boolean;
  lockMode: LockMode;
  manualPanZoom: boolean;
  bodyColors: string[];
  baselineDiagnostics: DiagnosticsSnapshot;
  diagnostics: DiagnosticsSnapshot;
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onTogglePanelExpanded: () => void;
  onVisibleHeightChange: (height: number) => void;
};

type UseAppViewModelsResult = {
  stageHudProps: ComponentProps<typeof StageHud>;
  stageControlsProps: ComponentProps<typeof StageControls>;
  diagnosticsProps: ComponentProps<typeof CanvasDiagnostics>;
};

export const useAppViewModels = ({
  world,
  params,
  panelExpanded,
  lockMode,
  manualPanZoom,
  bodyColors,
  baselineDiagnostics,
  diagnostics,
  onStartPause,
  onReset,
  onStep,
  onTogglePanelExpanded,
  onVisibleHeightChange,
}: UseAppViewModelsInput): UseAppViewModelsResult => {
  const diagnosticsViewModel = stageDiagnosticsViewModelForWorld({
    world,
    params,
    ejectionThresholdSec: EJECTION_TIME_THRESHOLD_SECONDS,
  });
  const pairStateLabel = boundPairStateLabel(
    diagnosticsViewModel.displayPairState,
    world.dissolutionDetected,
  );
  const stageViewModel = stageViewModelForWorld({
    world,
    lockMode,
    manualPanZoom,
    bodyColors,
    pairStateLabel,
  });

  return {
    stageHudProps: {
      statusLabel: stageViewModel.statusLabel,
      ejectedStatusRows: stageViewModel.ejectedStatusRows,
      elapsedTime: world.elapsedTime,
      speed: params.speed,
      panelExpanded,
      onTogglePanelExpanded,
    },
    stageControlsProps: {
      runButtonLabel: stageViewModel.runButtonLabel,
      runButtonTooltip: stageViewModel.runButtonTooltip,
      onStartPause,
      onReset,
      onStep,
      ejectedBodyId: world.ejectedBodyId,
      latestEjectedLabel: stageViewModel.latestEjectedLabel,
      dissolutionJustDetected: world.dissolutionJustDetected,
    },
    diagnosticsProps: {
      pairEnergies: diagnosticsViewModel.pairEnergies,
      displayPairState: diagnosticsViewModel.displayPairState,
      dissolutionCounterSec: world.dissolutionCounterSec,
      dissolutionThresholdSec: DISSOLUTION_TIME_THRESHOLD_SECONDS,
      dissolutionDetected: world.dissolutionDetected,
      diagnostics,
      baselineDiagnostics,
      bodyVectors: diagnosticsViewModel.bodyVectors,
      bodyEjectionStatuses: diagnosticsViewModel.bodyEjectionStatuses,
      onVisibleHeightChange,
    },
  };
};
