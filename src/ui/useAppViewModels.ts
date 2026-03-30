import type { ComponentProps } from "react";
import { EJECTION_TIME_THRESHOLD_SECONDS } from "../sim/ejection";
import {
  DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  displayPairStateFromEnergies,
  pairEnergiesForBodies,
  stageDiagnosticsViewModelForWorld,
} from "../sim/diagnosticsSelectors";
import { DISSOLUTION_TIME_THRESHOLD_SECONDS } from "../sim/simulationPolicies";
import { effectiveSimulationDt } from "../sim/simulationTick";
import { boundPairStateLabel, stageViewModelForWorld } from "../sim/stageSelectors";
import type { DiagnosticsSnapshot, LockMode, SimParams, WorldState } from "../sim/types";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { StageControls } from "./stage/StageControls";
import { StageHud } from "./stage/StageHud";

type UseAppViewModelsInput = {
  world: WorldState;
  params: SimParams;
  diagnosticsWorld: WorldState;
  diagnosticsParams: SimParams;
  panelExpanded: boolean;
  lockMode: LockMode;
  manualPanZoom: boolean;
  bodyColors: string[];
  baselineDiagnostics: DiagnosticsSnapshot;
  diagnostics: DiagnosticsSnapshot;
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack: () => void;
  canStepBack: boolean;
  accelerationActive: boolean;
  accelerationBurst: number;
  accelerationDirection: "forward" | "backward" | null;
  historySnapshotCount: number;
  historyMaxSteps: number;
  historyEstimatedBytes: number;
  onStepAccelerationChange?: ComponentProps<typeof StageControls>["onStepAccelerationChange"];
  onTogglePanelExpanded: () => void;
  onVisibleHeightChange: (height: number) => void;
  diagnosticsOpen: boolean;
  onDiagnosticsOpenChange: (isOpen: boolean) => void;
};

type UseAppViewModelsResult = {
  stageHudProps: ComponentProps<typeof StageHud>;
  stageControlsProps: ComponentProps<typeof StageControls>;
  diagnosticsProps: ComponentProps<typeof CanvasDiagnostics>;
};

type DiagnosticsViewModel = {
  pairEnergies: ReturnType<typeof pairEnergiesForBodies>;
  displayPairState: ReturnType<typeof displayPairStateFromEnergies> & { eps: number };
  bodyVectors: ReturnType<typeof stageDiagnosticsViewModelForWorld>["bodyVectors"];
  bodyEjectionStatuses: ReturnType<typeof stageDiagnosticsViewModelForWorld>["bodyEjectionStatuses"];
};

let cachedDiagnosticsInput:
  | {
      world: WorldState;
      params: SimParams;
      diagnosticsOpen: boolean;
    }
  | null = null;
let cachedDiagnosticsViewModel: DiagnosticsViewModel | null = null;

const getDiagnosticsViewModel = ({
  world,
  params,
  diagnosticsOpen,
}: {
  world: WorldState;
  params: SimParams;
  diagnosticsOpen: boolean;
}): DiagnosticsViewModel => {
  if (
    cachedDiagnosticsInput &&
    cachedDiagnosticsInput.world === world &&
    cachedDiagnosticsInput.params === params &&
    cachedDiagnosticsInput.diagnosticsOpen === diagnosticsOpen &&
    cachedDiagnosticsViewModel
  ) {
    return cachedDiagnosticsViewModel;
  }

  const pairEnergies = pairEnergiesForBodies(world.bodies, params);
  const displayPairState = {
    ...displayPairStateFromEnergies(
      pairEnergies.eps12,
      pairEnergies.eps13,
      pairEnergies.eps23,
      world.ejectedBodyIds.length > 0,
      DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
    ),
    eps: DEFAULT_DISPLAY_PAIR_ENERGY_EPS,
  };

  const diagnosticsViewModel: DiagnosticsViewModel = diagnosticsOpen
    ? stageDiagnosticsViewModelForWorld({
        world,
        params,
        ejectionThresholdSec: EJECTION_TIME_THRESHOLD_SECONDS,
      })
    : {
        pairEnergies,
        displayPairState,
        bodyVectors: [],
        bodyEjectionStatuses: [],
      };

  cachedDiagnosticsInput = { world, params, diagnosticsOpen };
  cachedDiagnosticsViewModel = diagnosticsViewModel;
  return diagnosticsViewModel;
};

export const useAppViewModels = ({
  world,
  params,
  diagnosticsWorld,
  diagnosticsParams,
  panelExpanded,
  lockMode,
  manualPanZoom,
  bodyColors,
  baselineDiagnostics,
  diagnostics,
  onStartPause,
  onReset,
  onStep,
  onStepBack,
  canStepBack,
  accelerationActive,
  accelerationBurst,
  accelerationDirection,
  historySnapshotCount,
  historyMaxSteps,
  historyEstimatedBytes,
  onStepAccelerationChange,
  onTogglePanelExpanded,
  onVisibleHeightChange,
  diagnosticsOpen,
  onDiagnosticsOpenChange,
}: UseAppViewModelsInput): UseAppViewModelsResult => {
  const diagnosticsViewModel = getDiagnosticsViewModel({
    world: diagnosticsWorld,
    params: diagnosticsParams,
    diagnosticsOpen,
  });

  const { displayPairState } = diagnosticsViewModel;
  const pairStateLabel = boundPairStateLabel(
    displayPairState,
    diagnosticsWorld.dissolutionDetected,
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
      dt: effectiveSimulationDt(params),
      accelerationActive,
      accelerationBurst,
      accelerationDirection,
      isRunning: world.isRunning,
      canStepBack,
      panelExpanded,
      onTogglePanelExpanded,
    },
    stageControlsProps: {
      runButtonLabel: stageViewModel.runButtonLabel,
      runButtonTooltip: stageViewModel.runButtonTooltip,
      onStartPause,
      onReset,
      onStep,
      onStepBack,
      canStepBack,
      historySnapshotCount,
      historyMaxSteps,
      historyEstimatedBytes,
      onStepAccelerationChange,
      ejectedBodyId: world.ejectedBodyId,
      latestEjectedLabel: stageViewModel.latestEjectedLabel,
      dissolutionJustDetected: world.dissolutionJustDetected,
    },
    diagnosticsProps: {
      pairEnergies: diagnosticsViewModel.pairEnergies,
      displayPairState: diagnosticsViewModel.displayPairState,
      dissolutionCounterSec: diagnosticsWorld.dissolutionCounterSec,
      dissolutionThresholdSec: DISSOLUTION_TIME_THRESHOLD_SECONDS,
      dissolutionDetected: diagnosticsWorld.dissolutionDetected,
      diagnostics,
      baselineDiagnostics,
      bodyVectors: diagnosticsViewModel.bodyVectors,
      bodyEjectionStatuses: diagnosticsViewModel.bodyEjectionStatuses,
      onVisibleHeightChange,
      onOpenChange: onDiagnosticsOpenChange,
    },
  };
};
