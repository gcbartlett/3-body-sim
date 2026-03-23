import type { DisplayPairState } from "./diagnosticsSelectors";
import type { LockMode, WorldState } from "./types";

export type EjectedBodyStatusBadge = {
  id: string;
  label: string;
  color: string;
};

type StagePairStateLabel = "Dissolved" | "Dissolving" | "Binary+Single" | "Resonant";

type StageViewModelInput = {
  world: WorldState;
  lockMode: LockMode;
  manualPanZoom: boolean;
  bodyColors: string[];
  pairStateLabel: StagePairStateLabel;
};

export type StageViewModel = {
  runButtonLabel: string;
  runButtonTooltip: string;
  statusLabel: string;
  ejectedStatusRows: EjectedBodyStatusBadge[];
  latestEjectedLabel: string | null;
};

export const boundPairStateLabel = (
  displayPairState: DisplayPairState,
  dissolutionDetected: boolean,
): StagePairStateLabel => {
  if (dissolutionDetected) {
    return "Dissolved";
  }
  return displayPairState.state === "dissolving"
    ? "Dissolving"
    : displayPairState.state === "binary+single"
    ? "Binary+Single"
    : "Resonant";
};

export const ejectedBodiesForStatus = (
  world: WorldState,
  bodyColors: string[],
): EjectedBodyStatusBadge[] =>
  world.ejectedBodyIds.map((id) => {
    const idx = world.bodies.findIndex((body) => body.id === id);
    return {
      id,
      label: idx >= 0 ? `B${idx + 1}` : id,
      color: idx >= 0 ? bodyColors[idx] ?? "#d1d5db" : "#d1d5db",
    };
  });

export const latestEjectedLabelForStatus = (world: WorldState): string | null => {
  if (!world.ejectedBodyId) {
    return null;
  }
  const idx = world.bodies.findIndex((body) => body.id === world.ejectedBodyId);
  return idx >= 0 ? `B${idx + 1}` : world.ejectedBodyId;
};

export const statusLabelForWorld = (
  world: Pick<WorldState, "dissolutionDetected" | "isRunning" | "elapsedTime">,
  statusModeSegment: string,
  pairStateLabel: StagePairStateLabel,
): string => {
  if (world.dissolutionDetected && !world.isRunning) {
    return "Dissolved";
  }
  if (world.isRunning) {
    return `Running • ${statusModeSegment} • ${pairStateLabel}`;
  }
  if (world.elapsedTime > 0) {
    return `Paused • ${statusModeSegment} • ${pairStateLabel}`;
  }
  return `Ready • ${statusModeSegment} • ${pairStateLabel}`;
};

const runButtonCopyForWorld = (
  world: Pick<WorldState, "isRunning" | "elapsedTime">,
): Pick<StageViewModel, "runButtonLabel" | "runButtonTooltip"> => {
  if (world.isRunning) {
    return {
      runButtonLabel: "Pause",
      runButtonTooltip: "Pause simulation time progression.",
    };
  }
  if (world.elapsedTime > 0) {
    return {
      runButtonLabel: "Resume",
      runButtonTooltip: "Resume running the simulation.",
    };
  }
  return {
    runButtonLabel: "Start",
    runButtonTooltip: "Start running the simulation.",
  };
};

const lockModeLabelForStage = (lockMode: LockMode): string =>
  lockMode === "none" ? "No Lock" : lockMode === "origin" ? "Origin Lock" : "COM Lock";

export const stageViewModelForWorld = ({
  world,
  lockMode,
  manualPanZoom,
  bodyColors,
  pairStateLabel,
}: StageViewModelInput): StageViewModel => {
  const runButtonCopy = runButtonCopyForWorld(world);
  const statusModeSegment = manualPanZoom ? "Manual" : lockModeLabelForStage(lockMode);
  return {
    ...runButtonCopy,
    statusLabel: statusLabelForWorld(world, statusModeSegment, pairStateLabel),
    ejectedStatusRows: ejectedBodiesForStatus(world, bodyColors),
    latestEjectedLabel: latestEjectedLabelForStatus(world),
  };
};
