import { memo, useEffect, useRef, type PointerEvent } from "react";
import {
  HOLD_ACCELERATION_TICK_MS,
  IDLE_STEP_ACCELERATION,
  burstCountForHoldDuration,
  type StepAccelerationDirection,
  type StepAccelerationState,
} from "../stepAcceleration";
import { useStableCallback } from "../useStableCallback";

type StageControlsProps = {
  runButtonLabel: string;
  runButtonTooltip: string;
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack: () => void;
  canStepBack: boolean;
  historySnapshotCount: number;
  historyMaxSteps: number;
  historyEstimatedBytes: number;
  onStepAccelerationChange?: (next: StepAccelerationState) => void;
  ejectedBodyId: string | null;
  latestEjectedLabel: string | null;
  dissolutionJustDetected: boolean;
};

type HoldStopReason = "pointer-up" | "pointer-leave" | "pointer-cancel" | "cleanup";

const BACK_BUTTON_TOOLTIP =
  "Move simulation back by one frame.\n" + "Hold to accelerate.\n" + "Hotkey: Left Arrow.";
const STEP_BUTTON_TOOLTIP =
  "Move simulation forward by one frame.\n" + "Hold to accelerate.\n" + "Hotkey: Right Arrow.";

export const burstCountForPointerHold = (holdDurationMs: number): number =>
  burstCountForHoldDuration(holdDurationMs);

export const shouldKeepClickSuppressionAfterStop = (reason: HoldStopReason): boolean =>
  reason === "pointer-up";

const formatEstimatedMemory = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const BackIcon = () => (
  <svg className="stage-control-svg" viewBox="0 0 24 24" aria-hidden="true">
    <line x1="18" y1="5.5" x2="18" y2="18.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    <polygon points="14,6 6,12 14,18" fill="currentColor" />
  </svg>
);

const StepIcon = () => (
  <svg className="stage-control-svg" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points="10,6 18,12 10,18" fill="currentColor" />
    <line x1="6" y1="5.5" x2="6" y2="18.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);

const PlayIcon = () => (
  <svg className="stage-control-svg" viewBox="0 0 24 24" aria-hidden="true">
    <polygon points="6.3,4.2 19.7,12 6.3,19.8" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg className="stage-control-svg" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="4.4" width="5.1" height="15.2" fill="currentColor" />
    <rect x="12.9" y="4.4" width="5.1" height="15.2" fill="currentColor" />
  </svg>
);

const ResetIcon = () => (
  <svg className="stage-control-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20 4v5h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M20 9a8 8 0 1 0 1.2 5.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type StageControlButtonsProps = Pick<
  StageControlsProps,
  | "runButtonLabel"
  | "runButtonTooltip"
  | "onStartPause"
  | "onReset"
  | "onStep"
  | "onStepBack"
  | "canStepBack"
  | "onStepAccelerationChange"
>;

const StageControlButtons = memo(function StageControlButtonsComponent({
  runButtonLabel,
  runButtonTooltip,
  onStartPause,
  onReset,
  onStep,
  onStepBack,
  canStepBack,
  onStepAccelerationChange,
}: StageControlButtonsProps) {
  const holdIntervalIdRef = useRef<number | null>(null);
  const holdStartedAtRef = useRef<number | null>(null);
  const holdActionRef = useRef<(() => void) | null>(null);
  const holdRequiresBackGuardRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const canStepBackRef = useRef(canStepBack);

  useEffect(() => {
    canStepBackRef.current = canStepBack;
  }, [canStepBack]);

  const stopHold = (reason: HoldStopReason) => {
    if (holdIntervalIdRef.current !== null) {
      window.clearInterval(holdIntervalIdRef.current);
      holdIntervalIdRef.current = null;
    }
    holdStartedAtRef.current = null;
    holdActionRef.current = null;
    holdRequiresBackGuardRef.current = false;
    if (!shouldKeepClickSuppressionAfterStop(reason)) {
      suppressNextClickRef.current = false;
    }
    onStepAccelerationChange?.(IDLE_STEP_ACCELERATION);
  };

  useEffect(
    () => () => {
      if (holdIntervalIdRef.current !== null) {
        window.clearInterval(holdIntervalIdRef.current);
        holdIntervalIdRef.current = null;
      }
      holdStartedAtRef.current = null;
      holdActionRef.current = null;
      holdRequiresBackGuardRef.current = false;
      suppressNextClickRef.current = false;
      onStepAccelerationChange?.(IDLE_STEP_ACCELERATION);
    },
    [onStepAccelerationChange],
  );

  const runBurstAction = (action: () => void, burstCount: number) => {
    for (let i = 0; i < burstCount; i += 1) {
      action();
    }
  };

  const startHold = (action: () => void, direction: StepAccelerationDirection) => {
    const requiresBackGuard = direction === "backward";
    if (requiresBackGuard && !canStepBackRef.current) {
      return;
    }

    stopHold("cleanup");
    suppressNextClickRef.current = true;
    holdStartedAtRef.current = performance.now();
    holdActionRef.current = action;
    holdRequiresBackGuardRef.current = requiresBackGuard;
    runBurstAction(action, 1);
    onStepAccelerationChange?.({
      source: "pointer",
      direction,
      burst: 1,
      active: true,
    });

    holdIntervalIdRef.current = window.setInterval(() => {
      const activeAction = holdActionRef.current;
      if (!activeAction || holdStartedAtRef.current === null) {
        return;
      }
      if (holdRequiresBackGuardRef.current && !canStepBackRef.current) {
        stopHold("cleanup");
        return;
      }
      const holdDurationMs = Math.max(0, performance.now() - holdStartedAtRef.current);
      runBurstAction(activeAction, burstCountForPointerHold(holdDurationMs));
      onStepAccelerationChange?.({
        source: "pointer",
        direction,
        burst: burstCountForPointerHold(holdDurationMs),
        active: true,
      });
    }, HOLD_ACCELERATION_TICK_MS);
  };

  const handleStepBackClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onStepBack();
  };

  const handleStepClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onStep();
  };

  const handlePointerDownBack = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    startHold(onStepBack, "backward");
  };

  const handlePointerDownStep = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    startHold(onStep, "forward");
  };

  const runIcon = runButtonLabel === "Pause" ? <PauseIcon /> : <PlayIcon />;
  const runLabel = runButtonLabel.toUpperCase();

  return (
    <div className="button-row">
      <button
        onClick={handleStepBackClick}
        onPointerDown={handlePointerDownBack}
        onPointerUp={() => stopHold("pointer-up")}
        onPointerLeave={() => stopHold("pointer-leave")}
        onPointerCancel={() => stopHold("pointer-cancel")}
        disabled={!canStepBack}
        title={BACK_BUTTON_TOOLTIP}
      >
        <span className="stage-control-icon">
          <BackIcon />
        </span>
        <span className="stage-control-label">BACK</span>
      </button>
      <button onClick={onStartPause} title={runButtonTooltip}>
        <span className="stage-control-icon">{runIcon}</span>
        <span className="stage-control-label">{runLabel}</span>
      </button>
      <button
        onClick={handleStepClick}
        onPointerDown={handlePointerDownStep}
        onPointerUp={() => stopHold("pointer-up")}
        onPointerLeave={() => stopHold("pointer-leave")}
        onPointerCancel={() => stopHold("pointer-cancel")}
        title={STEP_BUTTON_TOOLTIP}
      >
        <span className="stage-control-icon">
          <StepIcon />
        </span>
        <span className="stage-control-label">STEP</span>
      </button>
      <button onClick={onReset} title="Reset to current initial conditions and clear trails.">
        <span className="stage-control-icon">
          <ResetIcon />
        </span>
        <span className="stage-control-label">RESET</span>
      </button>
    </div>
  );
});
StageControlButtons.displayName = "StageControlButtons";

type StageHistoryLiveProps = Pick<
  StageControlsProps,
  "historySnapshotCount" | "historyMaxSteps" | "historyEstimatedBytes"
>;

const StageHistoryLive = memo(function StageHistoryLiveComponent({
  historySnapshotCount,
  historyMaxSteps,
  historyEstimatedBytes,
}: StageHistoryLiveProps) {
  const historyFillRatio =
    historyMaxSteps > 0 ? Math.max(0, Math.min(1, historySnapshotCount / historyMaxSteps)) : 0;
  const historyFillPercent = `${historyFillRatio * 100}%`;

  return (
    <div className="stage-history-controls">
      <div
        className="stage-history-buffer"
        title={`History buffer usage: ${historySnapshotCount}/${historyMaxSteps} snapshots`}
      >
        <div className="stage-history-buffer-fill" style={{ width: historyFillPercent }} />
      </div>
      <p className="stage-history-metrics">
        {historySnapshotCount}/{historyMaxSteps} snapshots, ~{formatEstimatedMemory(historyEstimatedBytes)}
      </p>
    </div>
  );
});
StageHistoryLive.displayName = "StageHistoryLive";

type StageWarningsProps = Pick<
  StageControlsProps,
  "ejectedBodyId" | "latestEjectedLabel" | "dissolutionJustDetected"
>;

const StageWarnings = memo(function StageWarningsComponent({
  ejectedBodyId,
  latestEjectedLabel,
  dissolutionJustDetected,
}: StageWarningsProps) {
  return (
  <>
    {ejectedBodyId && (
      <p className="warning">
        Paused: {latestEjectedLabel ?? ejectedBodyId} newly ejected from system.
      </p>
    )}
    {dissolutionJustDetected && <p className="warning">Paused: system dissolved.</p>}
  </>
  );
});
StageWarnings.displayName = "StageWarnings";

const StageControlsComponent = ({
  runButtonLabel,
  runButtonTooltip,
  onStartPause,
  onReset,
  onStep,
  onStepBack,
  canStepBack,
  historySnapshotCount,
  historyMaxSteps,
  historyEstimatedBytes,
  onStepAccelerationChange,
  ejectedBodyId,
  latestEjectedLabel,
  dissolutionJustDetected,
}: StageControlsProps) => {
  const onStartPauseStable = useStableCallback(onStartPause);
  const onResetStable = useStableCallback(onReset);
  const onStepStable = useStableCallback(onStep);
  const onStepBackStable = useStableCallback(onStepBack);

  return (
    <div className="stage-controls">
      <StageControlButtons
        runButtonLabel={runButtonLabel}
        runButtonTooltip={runButtonTooltip}
        onStartPause={onStartPauseStable}
        onReset={onResetStable}
        onStep={onStepStable}
        onStepBack={onStepBackStable}
        canStepBack={canStepBack}
        onStepAccelerationChange={onStepAccelerationChange}
      />
      <StageHistoryLive
        historySnapshotCount={historySnapshotCount}
        historyMaxSteps={historyMaxSteps}
        historyEstimatedBytes={historyEstimatedBytes}
      />
      <StageWarnings
        ejectedBodyId={ejectedBodyId}
        latestEjectedLabel={latestEjectedLabel}
        dissolutionJustDetected={dissolutionJustDetected}
      />
    </div>
  );
};

export const StageControls = memo(StageControlsComponent);
StageControls.displayName = "StageControls";
