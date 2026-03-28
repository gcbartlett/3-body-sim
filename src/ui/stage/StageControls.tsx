type StageControlsProps = {
  runButtonLabel: string;
  runButtonTooltip: string;
  onStartPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onStepBack: () => void;
  canStepBack: boolean;
  ejectedBodyId: string | null;
  latestEjectedLabel: string | null;
  dissolutionJustDetected: boolean;
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

export const StageControls = ({
  runButtonLabel,
  runButtonTooltip,
  onStartPause,
  onReset,
  onStep,
  onStepBack,
  canStepBack,
  ejectedBodyId,
  latestEjectedLabel,
  dissolutionJustDetected,
}: StageControlsProps) => {
  const runIcon = runButtonLabel === "Pause" ? <PauseIcon /> : <PlayIcon />;
  const runLabel = runButtonLabel.toUpperCase();

  return (
    <div className="stage-controls">
      <div className="button-row">
        <button
          onClick={onStepBack}
          disabled={!canStepBack}
          title={"Go back one stored simulation frame.\n" + "Hotkey: Left Arrow."}
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
        <button onClick={onStep} title={"Advance simulation by one integration step.\n" + "Hotkey: Right Arrow."}>
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
      {ejectedBodyId && (
        <p className="warning">
          Paused: {latestEjectedLabel ?? ejectedBodyId} newly ejected from system.
        </p>
      )}
      {dissolutionJustDetected && <p className="warning">Paused: system dissolved.</p>}
    </div>
  );
};
