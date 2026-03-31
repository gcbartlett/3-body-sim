import { memo } from "react";
import type { EjectedBodyStatusBadge } from "../../sim/stageSelectors";

type StageHudProps = {
  statusLabel: string;
  ejectedStatusRows: EjectedBodyStatusBadge[];
  elapsedTime: number;
  speed: number;
  dt: number;
  accelerationActive: boolean;
  accelerationBurst: number;
  accelerationDirection: "forward" | "backward" | null;
  isRunning: boolean;
  canStepBack: boolean;
  panelExpanded: boolean;
  onTogglePanelExpanded: () => void;
};

export const StageHud = ({
  statusLabel,
  ejectedStatusRows,
  elapsedTime,
  speed,
  dt,
  accelerationActive,
  accelerationBurst,
  accelerationDirection,
  isRunning,
  canStepBack,
  panelExpanded,
  onTogglePanelExpanded,
}: StageHudProps) => {
  const showPaused =
    (!isRunning && !accelerationActive) ||
    (accelerationDirection === "backward" && !canStepBack && !accelerationActive);
  const signedRate =
    accelerationDirection === "backward" ? `-${Math.abs(speed).toFixed(2)}x` : `+${Math.abs(speed).toFixed(2)}x`;

  return (
    <div className="stage-hud-cluster">
      <div className="top-right-tools">
        <div
          className="hud"
          title={
            `Elapsed simulation time and current simulation rate (dt=${dt.toFixed(4)}).\n` +
            "Hotkeys: Space start/pause/resume, Right Arrow step, '+' faster, '-' slower,\n" +
            "L cycle lock mode, G toggle grid, C toggle COM, O toggle origin."
          }
        >
          <div>t = {elapsedTime.toFixed(3)}</div>
          <div>
            rate = {showPaused ? "paused" : signedRate}{" "}
            {!showPaused && accelerationBurst > 1 ? (
              <span className="hud-accent">x{accelerationBurst}</span>
            ) : null}
          </div>
        </div>
        <PanelToggleButton
          panelExpanded={panelExpanded}
          onTogglePanelExpanded={onTogglePanelExpanded}
        />
      </div>
      <div className="canvas-status" title="Simulation status and active camera mode.">
        <span>{statusLabel}</span>
        {ejectedStatusRows.length > 0 ? (
          <span>
            {" • Ejected: "}
            {ejectedStatusRows.map((body, index) => (
              <span key={body.id}>
                <span className="status-eject-body" style={{ color: body.color }}>
                  {body.label}
                </span>
                {index < ejectedStatusRows.length - 1 ? ", " : ""}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
};

type PanelToggleButtonProps = Pick<StageHudProps, "panelExpanded" | "onTogglePanelExpanded">;

const PanelToggleButton = memo(function PanelToggleButtonComponent({
  panelExpanded,
  onTogglePanelExpanded,
}: PanelToggleButtonProps) {
  return (
    <button
      className="panel-toggle-icon"
      title={panelExpanded ? "Hide panel (maximize canvas)" : "Show panel (restore layout)"}
      onClick={onTogglePanelExpanded}
      aria-label={panelExpanded ? "Maximize canvas" : "Restore panel"}
    >
      {panelExpanded ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </button>
  );
});
PanelToggleButton.displayName = "PanelToggleButton";
