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
}: StageControlsProps) => (
  <div className="stage-controls">
    <div className="button-row">
      <button onClick={onStartPause} title={runButtonTooltip}>
        {runButtonLabel}
      </button>
      <button onClick={onReset} title="Reset to current initial conditions and clear trails.">
        Reset
      </button>
      <button onClick={onStep} title={"Advance simulation by one integration step.\n" + "Hotkey: Right Arrow."}>
        Step
      </button>
      <button
        onClick={onStepBack}
        disabled={!canStepBack}
        title={"Go back one stored simulation frame.\n" + "Hotkey: Left Arrow."}
      >
        Back
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
